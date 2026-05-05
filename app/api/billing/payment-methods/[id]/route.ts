import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware, unauthorized } from '@/lib/auth'
import { stripe } from '@/lib/stripe'

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = authMiddleware(req)
  if (!user) return unauthorized()

  try {
    const pm = await prisma.paymentMethod.findFirst({
      where: { id: params.id, memberId: user.sub },
    })
    if (!pm) return NextResponse.json({ error: 'Payment method not found' }, { status: 404 })

    // Check it's not used for active auto-pay
    const autopay = await prisma.autoPaySetting.findFirst({
      where: { paymentMethodId: pm.id, enabled: true },
    })
    if (autopay) {
      return NextResponse.json({ error: 'Cannot remove a card used for active auto-pay. Disable auto-pay first.' }, { status: 400 })
    }

    // Detach from Stripe
    await stripe.paymentMethods.detach(pm.stripePaymentMethodId)

    await prisma.paymentMethod.delete({ where: { id: pm.id } })

    return NextResponse.json({ message: 'Payment method removed' })
  } catch (err) {
    console.error('Delete PM error:', err)
    return NextResponse.json({ error: 'Failed to remove payment method' }, { status: 500 })
  }
}
