import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { signAccessToken, signRefreshToken, getRefreshTokenExpiry } from '@/lib/auth'
import { stripe } from '@/lib/stripe'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = schema.parse(body)

    const existing = await prisma.member.findUnique({ where: { email: data.email } })
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(data.password, 12)
    const member = await prisma.member.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
      },
    })

    const payload = { sub: member.id, email: member.email }
    const accessToken = signAccessToken(payload)
    const refreshToken = signRefreshToken(payload)

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        memberId: member.id,
        expiresAt: getRefreshTokenExpiry(),
      },
    })

    const isStripeTestMode = process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') ?? false

    if (isStripeTestMode) {
      try {
        const customer = await stripe.customers.create({
          email: member.email,
          name: `${member.firstName} ${member.lastName}`,
          metadata: { memberId: member.id },
        })

        // pm_card_visa is a Stripe test fixture — attach creates a unique clone for this customer
        const pm = await stripe.paymentMethods.attach('pm_card_visa', { customer: customer.id })

        await stripe.customers.update(customer.id, {
          invoice_settings: { default_payment_method: pm.id },
        })

        await prisma.member.update({
          where: { id: member.id },
          data: { stripeCustomerId: customer.id },
        })

        await prisma.paymentMethod.create({
          data: {
            memberId: member.id,
            stripePaymentMethodId: pm.id,
            last4: pm.card?.last4 ?? '4242',
            brand: pm.card?.brand ?? 'visa',
            expMonth: pm.card?.exp_month ?? 12,
            expYear: pm.card?.exp_year ?? 2034,
            isDefault: true,
          },
        })
      } catch (e) {
        console.error('[register] Failed to create test payment method:', e)
      }
    }

    return NextResponse.json({
      accessToken,
      refreshToken,
      member: {
        id: member.id,
        email: member.email,
        firstName: member.firstName,
        lastName: member.lastName,
      },
    }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: err.issues }, { status: 400 })
    }
    console.error('Register error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
