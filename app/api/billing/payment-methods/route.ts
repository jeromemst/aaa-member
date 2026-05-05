import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authMiddleware, unauthorized } from '@/lib/auth'
import { stripe } from '@/lib/stripe'

// GET — list saved payment methods
export async function GET(req: NextRequest) {
  const user = authMiddleware(req)
  if (!user) return unauthorized()

  const methods = await prisma.paymentMethod.findMany({
    where: { memberId: user.sub },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  })

  return NextResponse.json({ paymentMethods: methods })
}

const saveSchema = z.object({
  stripePaymentMethodId: z.string(),
  setDefault: z.boolean().optional(),
})

// POST — save a card after SetupIntent confirmation
export async function POST(req: NextRequest) {
  const user = authMiddleware(req)
  if (!user) return unauthorized()

  try {
    const body = await req.json()
    const { stripePaymentMethodId, setDefault } = saveSchema.parse(body)

    // Fetch card details from Stripe
    const pm = await stripe.paymentMethods.retrieve(stripePaymentMethodId)
    if (!pm.card) return NextResponse.json({ error: 'Not a card payment method' }, { status: 400 })

    // If setDefault, unset current default
    if (setDefault) {
      await prisma.paymentMethod.updateMany({
        where: { memberId: user.sub, isDefault: true },
        data: { isDefault: false },
      })
    }

    // Check if this is the first card (auto-default)
    const existingCount = await prisma.paymentMethod.count({ where: { memberId: user.sub } })
    const isDefault = setDefault || existingCount === 0

    const saved = await prisma.paymentMethod.create({
      data: {
        memberId: user.sub,
        stripePaymentMethodId,
        last4: pm.card.last4,
        brand: pm.card.brand,
        expMonth: pm.card.exp_month,
        expYear: pm.card.exp_year,
        isDefault,
      },
    })

    return NextResponse.json({ paymentMethod: saved }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }
    console.error('Save PM error:', err)
    return NextResponse.json({ error: 'Failed to save payment method' }, { status: 500 })
  }
}
