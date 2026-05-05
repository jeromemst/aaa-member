import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware, unauthorized } from '@/lib/auth'
import { stripe, getOrCreateStripeCustomer } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  const user = authMiddleware(req)
  if (!user) return unauthorized()

  try {
    const member = await prisma.member.findUnique({ where: { id: user.sub } })
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    const stripeCustomerId = await getOrCreateStripeCustomer(
      member.id,
      member.email,
      `${member.firstName} ${member.lastName}`,
      member.stripeCustomerId
    )

    if (!member.stripeCustomerId) {
      await prisma.member.update({ where: { id: member.id }, data: { stripeCustomerId } })
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      metadata: { memberId: member.id },
    })

    return NextResponse.json({ clientSecret: setupIntent.client_secret })
  } catch (err) {
    console.error('SetupIntent error:', err)
    return NextResponse.json({ error: 'Failed to create setup intent' }, { status: 500 })
  }
}
