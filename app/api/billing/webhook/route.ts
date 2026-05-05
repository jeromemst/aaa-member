import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { addMonths } from '@/lib/utils'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = headers().get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature error:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        // In Stripe API 2026+, subscription lives under invoice.parent.subscription_details.subscription
        const subscriptionId = (
          (invoice as any).parent?.subscription_details?.subscription ??
          (invoice as any).subscription
        ) as string | undefined

        if (!subscriptionId) break

        const autopay = await prisma.autoPaySetting.findFirst({
          where: { stripeSubscriptionId: subscriptionId },
          include: { policy: { include: { plan: true } } },
        })
        if (!autopay) break

        // Extend renewal date
        const newRenewal = addMonths(
          autopay.policy.renewalDate,
          autopay.policy.plan.billingCycle === 'ANNUAL' ? 12 : autopay.policy.plan.billingCycle === 'QUARTERLY' ? 3 : 1
        )
        await prisma.policy.update({
          where: { id: autopay.policyId },
          data: { renewalDate: newRenewal, status: 'ACTIVE' },
        })

        await prisma.billingHistory.create({
          data: {
            memberId: autopay.memberId,
            policyId: autopay.policyId,
            amount: (invoice.amount_paid ?? 0) / 100,
            status: 'SUCCEEDED',
            description: `Auto-pay renewal — ${autopay.policy.plan.name}`,
            stripeInvoiceId: invoice.id,
            paidAt: new Date(),
          },
        })
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = (
          (invoice as any).parent?.subscription_details?.subscription ??
          (invoice as any).subscription
        ) as string | undefined
        if (!subscriptionId) break

        const autopay = await prisma.autoPaySetting.findFirst({
          where: { stripeSubscriptionId: subscriptionId },
          include: { policy: { include: { plan: true } } },
        })
        if (!autopay) break

        await prisma.billingHistory.create({
          data: {
            memberId: autopay.memberId,
            policyId: autopay.policyId,
            amount: (invoice.amount_due ?? 0) / 100,
            status: 'FAILED',
            description: `Auto-pay failed — ${autopay.policy.plan.name}`,
            stripeInvoiceId: invoice.id,
          },
        })
        break
      }

      default:
        // Ignore unhandled events
        break
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook handler error:', err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
