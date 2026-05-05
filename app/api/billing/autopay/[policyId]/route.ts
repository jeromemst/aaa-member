import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware, unauthorized } from '@/lib/auth'
import { stripe } from '@/lib/stripe'

// DELETE — disable auto-pay for a policy
export async function DELETE(req: NextRequest, { params }: { params: { policyId: string } }) {
  const user = authMiddleware(req)
  if (!user) return unauthorized()

  try {
    const setting = await prisma.autoPaySetting.findFirst({
      where: { policyId: params.policyId, memberId: user.sub },
    })
    if (!setting) return NextResponse.json({ error: 'Auto-pay setting not found' }, { status: 404 })

    if (setting.stripeSubscriptionId) {
      await stripe.subscriptions.cancel(setting.stripeSubscriptionId)
    }

    await prisma.autoPaySetting.update({
      where: { id: setting.id },
      data: { enabled: false, stripeSubscriptionId: null },
    })

    return NextResponse.json({ message: 'Auto-pay disabled' })
  } catch (err) {
    console.error('AutoPay disable error:', err)
    return NextResponse.json({ error: 'Failed to disable auto-pay' }, { status: 500 })
  }
}
