import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authMiddleware, unauthorized } from '@/lib/auth'
import { stripe, getOrCreateStripeCustomer } from '@/lib/stripe'
import { generatePolicyNumber, addMonths } from '@/lib/utils'

const enrollSchema = z.object({
  planId: z.string(),
  paymentMethodId: z.string().optional(),
  devBypass: z.boolean().optional(),
})

// GET /api/policies — list member's policies
export async function GET(req: NextRequest) {
  const user = authMiddleware(req)
  if (!user) return unauthorized()

  const policies = await prisma.policy.findMany({
    where: { memberId: user.sub },
    include: {
      plan: true,
      autoPaySetting: { include: { paymentMethod: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ policies })
}

// POST /api/policies — enroll in a plan
export async function POST(req: NextRequest) {
  const user = authMiddleware(req)
  if (!user) return unauthorized()

  try {
    const body = await req.json()
    const { planId, paymentMethodId, devBypass } = enrollSchema.parse(body)

    const isDevBypass = devBypass === true && process.env.NEXT_PUBLIC_ENABLE_DEV_BYPASS === 'true'

    if (!isDevBypass && !paymentMethodId) {
      return NextResponse.json({ error: 'paymentMethodId is required' }, { status: 400 })
    }

    const plan = await prisma.insurancePlan.findUnique({ where: { id: planId } })
    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })

    const member = await prisma.member.findUnique({ where: { id: user.sub } })
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    if (!isDevBypass) {
      // Get or create Stripe customer
      const stripeCustomerId = await getOrCreateStripeCustomer(
        member.id,
        member.email,
        `${member.firstName} ${member.lastName}`,
        member.stripeCustomerId
      )

      if (!member.stripeCustomerId) {
        await prisma.member.update({ where: { id: member.id }, data: { stripeCustomerId } })
      }

      // Charge first premium via Stripe
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(plan.premium * 100), // cents
        currency: 'usd',
        customer: stripeCustomerId,
        payment_method: paymentMethodId,
        confirm: true,
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        description: `First premium for ${plan.name}`,
        metadata: { memberId: member.id, planId: plan.id },
      })

      if (paymentIntent.status !== 'succeeded') {
        return NextResponse.json({ error: 'Payment failed', status: paymentIntent.status }, { status: 402 })
      }

      const now = new Date()
      const renewalDate = addMonths(now, plan.billingCycle === 'ANNUAL' ? 12 : plan.billingCycle === 'QUARTERLY' ? 3 : 1)

      const policy = await prisma.policy.create({
        data: {
          policyNumber: generatePolicyNumber(),
          memberId: member.id,
          planId: plan.id,
          status: 'ACTIVE',
          startDate: now,
          renewalDate,
        },
        include: { plan: true },
      })

      await prisma.billingHistory.create({
        data: {
          memberId: member.id,
          policyId: policy.id,
          amount: plan.premium,
          status: 'SUCCEEDED',
          description: `First premium — ${plan.name}`,
          stripePaymentIntentId: paymentIntent.id,
          paidAt: new Date(),
        },
      })

      return NextResponse.json({ policy }, { status: 201 })
    }

    // Dev bypass — skip Stripe entirely
    const now = new Date()
    const renewalDate = addMonths(now, plan.billingCycle === 'ANNUAL' ? 12 : plan.billingCycle === 'QUARTERLY' ? 3 : 1)

    const policy = await prisma.policy.create({
      data: {
        policyNumber: generatePolicyNumber(),
        memberId: member.id,
        planId: plan.id,
        status: 'ACTIVE',
        startDate: now,
        renewalDate,
      },
      include: { plan: true },
    })

    await prisma.billingHistory.create({
      data: {
        memberId: member.id,
        policyId: policy.id,
        amount: plan.premium,
        status: 'SUCCEEDED',
        description: `First premium — ${plan.name} (dev bypass)`,
        stripePaymentIntentId: 'dev_bypass',
        paidAt: new Date(),
      },
    })

    return NextResponse.json({ policy }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: err.issues }, { status: 400 })
    }
    console.error('Enroll error:', err)
    return NextResponse.json({ error: 'Enrollment failed' }, { status: 500 })
  }
}
