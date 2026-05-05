import { PrismaClient, PlanType, BillingCycle } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Seed insurance plans
  const plans = [
    {
      name: 'Basic Health Shield',
      type: PlanType.HEALTH,
      description: 'Essential health coverage for individuals. Covers doctor visits, emergency care, and basic prescriptions.',
      premium: 149.99,
      coverageAmount: 100000,
      deductible: 2500,
      billingCycle: BillingCycle.MONTHLY,
      features: ['Primary care visits', 'Emergency room coverage', 'Generic prescriptions', 'Preventive care', 'Telehealth services'],
    },
    {
      name: 'Premium Health Plus',
      type: PlanType.HEALTH,
      description: 'Comprehensive health coverage with low deductibles and specialist access for families.',
      premium: 349.99,
      coverageAmount: 500000,
      deductible: 500,
      billingCycle: BillingCycle.MONTHLY,
      features: ['Unlimited specialist visits', 'Mental health coverage', 'Brand-name prescriptions', 'Dental & vision', 'International coverage', 'No referrals needed'],
    },
    {
      name: 'Auto Guard Standard',
      type: PlanType.AUTO,
      description: 'Reliable auto insurance covering liability, collision, and comprehensive damage.',
      premium: 89.99,
      coverageAmount: 50000,
      deductible: 1000,
      billingCycle: BillingCycle.MONTHLY,
      features: ['Liability coverage', 'Collision damage', 'Comprehensive coverage', 'Roadside assistance', 'Rental reimbursement'],
    },
    {
      name: 'Auto Guard Elite',
      type: PlanType.AUTO,
      description: 'Premium auto coverage with OEM parts, new car replacement, and rideshare coverage.',
      premium: 179.99,
      coverageAmount: 150000,
      deductible: 250,
      billingCycle: BillingCycle.MONTHLY,
      features: ['OEM parts guarantee', 'New car replacement', 'Rideshare coverage', 'Gap insurance', 'Accident forgiveness', '24/7 claims support'],
    },
    {
      name: 'Life Secure Term',
      type: PlanType.LIFE,
      description: '20-year term life insurance to protect your family\'s financial future.',
      premium: 29.99,
      coverageAmount: 250000,
      deductible: 0,
      billingCycle: BillingCycle.MONTHLY,
      features: ['$250K death benefit', '20-year term', 'Level premiums', 'Conversion option', 'Accelerated benefit rider'],
    },
    {
      name: 'Home Protect Complete',
      type: PlanType.HOME,
      description: 'Full homeowners insurance covering structure, belongings, liability, and additional living expenses.',
      premium: 119.99,
      coverageAmount: 300000,
      deductible: 1500,
      billingCycle: BillingCycle.MONTHLY,
      features: ['Dwelling coverage', 'Personal property', 'Liability protection', 'Additional living expenses', 'Water backup', 'Identity theft protection'],
    },
  ]

  for (const plan of plans) {
    await prisma.insurancePlan.upsert({
      where: { id: plan.name.toLowerCase().replace(/\s+/g, '-') },
      update: plan,
      create: {
        id: plan.name.toLowerCase().replace(/\s+/g, '-'),
        ...plan,
      },
    })
  }

  // Seed a demo member
  const passwordHash = await bcrypt.hash('Demo@1234', 12)
  await prisma.member.upsert({
    where: { email: 'demo@insuranceportal.com' },
    update: {},
    create: {
      email: 'demo@insuranceportal.com',
      passwordHash,
      firstName: 'Alex',
      lastName: 'Johnson',
      phone: '555-0100',
    },
  })

  console.log('✅ Seed complete: 6 plans + 1 demo member')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
