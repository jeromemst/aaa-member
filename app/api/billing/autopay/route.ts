import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authMiddleware, unauthorized } from '@/lib/auth'
import { stripe } from '@/lib/stripe'

const enableSchema = z.object({
  policyId: z.string(),
  paymentMethodId: z.string(), // internal DB id
})

// POST — enable auto-pay for a policy
export async function POST(req: NextRequest) {
  const user = authMiddleware(req)
  if (!user) return unauthorized()

  try {
    const body = await req.json()
    const { policyId, paymentMethodId } = enableSchema.parse(body)

    const policy = await prisma.policy.findFirst({
      where: { id: policyId, memberId: user.sub, status: 'ACTIVE' },
      include: { plan: true },
    })
    if (!policy) return NextResponse.json({ error: 'Active policy not found' }, { status: 404 })

    const pm = await prisma.paymentMethod.findFirst({
      where: { id: paymentMethodId, memberId: user.sub },
    })
    if (!pm) return NextResponse.json({ error: 'Payment method not found' }, { status: 404 })

    const member = await prisma.member.findUnique({ where: { id: user.sub } })

    // If the plan has a Stripe Price ID, create a full Stripe Subscription.
    // Otherwise, store the auto-pay preference in the DB and charge on renewal via /renew.
    let stripeSubscriptionId: string | null = null

    if (policy.plan.stripePriceId && member?.stripeCustomerId) {
      await stripe.customers.update(member.stripeCustomerId, {
        invoice_settings: { default_payment_method: pm.stripePaymentMethodId },
      })
      const subscription = await stripe.subscriptions.create({
        customer: member.stripeCustomerId,
        items: [{ price: policy.plan.stripePriceId }],
        default_payment_method: pm.stripePaymentMethodId,
        metadata: { memberId: user.sub, policyId: policy.id },
        billing_cycle_anchor: Math.floor(policy.renewalDate.getTime() / 1000),
        proration_behavior: 'none',
      })
      stripeSubscriptionId = subscription.id
    }

    const existing = await prisma.autoPaySetting.findUnique({ where: { policyId } })
    const autopay = existing
      ? await prisma.autoPaySetting.update({
          where: { policyId },
          data: { paymentMethodId: pm.id, stripeSubscriptionId, enabled: true },
        })
      : await prisma.autoPaySetting.create({
          data: {
            memberId: user.sub,
            policyId,
            paymentMethodId: pm.id,
            stripeSubscriptionId,
            enabled: true,
          },
        })

    return NextResponse.json({ autoPaySetting: autopay }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }
    console.error('AutoPay enable error:', err)
    return NextResponse.json({ error: 'Failed to enable auto-pay' }, { status: 500 })
  }
}
