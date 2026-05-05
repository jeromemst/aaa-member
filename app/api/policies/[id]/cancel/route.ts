import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware, unauthorized } from '@/lib/auth'
import { stripe } from '@/lib/stripe'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = authMiddleware(req)
  if (!user) return unauthorized()

  try {
    const policy = await prisma.policy.findFirst({
      where: { id: params.id, memberId: user.sub },
      include: { autoPaySetting: true },
    })

    if (!policy) return NextResponse.json({ error: 'Policy not found' }, { status: 404 })
    if (policy.status === 'CANCELLED') return NextResponse.json({ error: 'Policy already cancelled' }, { status: 400 })

    // Cancel Stripe subscription if exists
    if (policy.autoPaySetting?.stripeSubscriptionId) {
      await stripe.subscriptions.cancel(policy.autoPaySetting.stripeSubscriptionId)
    }

    const updated = await prisma.policy.update({
      where: { id: policy.id },
      data: { status: 'CANCELLED', endDate: new Date() },
      include: { plan: true },
    })

    return NextResponse.json({ policy: updated })
  } catch (err) {
    console.error('Cancel error:', err)
    return NextResponse.json({ error: 'Cancellation failed' }, { status: 500 })
  }
}
