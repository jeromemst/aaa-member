import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware, unauthorized } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = authMiddleware(req)
  if (!user) return unauthorized()

  const plan = await prisma.insurancePlan.findUnique({ where: { id: params.id } })
  if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })

  return NextResponse.json({ plan })
}
