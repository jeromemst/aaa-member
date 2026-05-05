import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware, unauthorized } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = authMiddleware(req)
  if (!user) return unauthorized()

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')

  const plans = await prisma.insurancePlan.findMany({
    where: {
      isActive: true,
      ...(type ? { type: type as any } : {}),
    },
    orderBy: { premium: 'asc' },
  })

  return NextResponse.json({ plans })
}
