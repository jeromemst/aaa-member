import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware, unauthorized } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = authMiddleware(req)
  if (!user) return unauthorized()

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '10')
  const skip = (page - 1) * limit

  const [records, total] = await Promise.all([
    prisma.billingHistory.findMany({
      where: { memberId: user.sub },
      include: { policy: { include: { plan: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.billingHistory.count({ where: { memberId: user.sub } }),
  ])

  return NextResponse.json({
    records,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  })
}
