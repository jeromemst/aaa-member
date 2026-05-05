import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
  typescript: true,
})

/** Get or create a Stripe customer for a member */
export async function getOrCreateStripeCustomer(
  memberId: string,
  email: string,
  name: string,
  existingCustomerId?: string | null
): Promise<string> {
  if (existingCustomerId) return existingCustomerId

  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { memberId },
  })

  return customer.id
}
