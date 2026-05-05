import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware, unauthorized } from '@/lib/auth'
import { stripe } from '@/lib/stripe'
import { addMonths } from '@/lib/utils'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = authMiddleware(req)
  if (!user) return unauthorized()

  try {
    const policy = await prisma.policy.findFirst({
      where: { id: params.id, memberId: user.sub },
      include: { plan: true, autoPaySetting: { include: { paymentMethod: true } } },
    })

    if (!policy) return NextResponse.json({ error: 'Policy not found' }, { status: 404 })
    if (policy.status === 'CANCELLED') return NextResponse.json({ error: 'Cannot renew cancelled policy' }, { status: 400 })

    const member = await prisma.member.findUnique({ where: { id: user.sub } })
    if (!member?.stripeCustomerId) return NextResponse.json({ error: 'No payment method on file' }, { status: 400 })

    // Find default or first payment method
    const pm = await prisma.paymentMethod.findFirst({
      where: { memberId: user.sub, isDefault: true },
    }) ?? await prisma.paymentMethod.findFirst({ where: { memberId: user.sub } })

    if (!pm) return NextResponse.json({ error: 'No payment method on file' }, { status: 400 })

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(policy.plan.premium * 100),
      currency: 'usd',
      customer: member.stripeCustomerId,
      payment_method: pm.stripePaymentMethodId,
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      description: `Renewal — ${policy.plan.name} (${policy.policyNumber})`,
    })

    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json({ error: 'Payment failed' }, { status: 402 })
    }

    const newRenewalDate = addMonths(
      policy.renewalDate,
      policy.plan.billingCycle === 'ANNUAL' ? 12 : policy.plan.billingCycle === 'QUARTERLY' ? 3 : 1
    )

    const updated = await prisma.policy.update({
      where: { id: policy.id },
      data: { renewalDate: newRenewalDate, status: 'ACTIVE' },
      include: { plan: true },
    })

    await prisma.billingHistory.create({
      data: {
        memberId: user.sub,
        policyId: policy.id,
        amount: policy.plan.premium,
        status: 'SUCCEEDED',
        description: `Manual renewal — ${policy.plan.name}`,
        stripePaymentIntentId: paymentIntent.id,
        paidAt: new Date(),
      },
    })

    return NextResponse.json({ policy: updated })
  } catch (err) {
    console.error('Renew error:', err)
    return NextResponse.json({ error: 'Renewal failed' }, { status: 500 })
  }
}
