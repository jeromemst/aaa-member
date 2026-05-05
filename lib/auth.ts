import jwt from 'jsonwebtoken'
import { NextRequest, NextResponse } from 'next/server'

const ACCESS_SECRET = process.env.JWT_SECRET!
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!
const ACCESS_EXPIRES = '15m'
const REFRESH_EXPIRES = '7d'

export interface JwtPayload {
  sub: string      // member id
  email: string
  iat?: number
  exp?: number
}

export function signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES })
}

export function signRefreshToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES })
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, ACCESS_SECRET) as JwtPayload
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, REFRESH_SECRET) as JwtPayload
}

export function getRefreshTokenExpiry(): Date {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d
}

/** Extract and verify the Bearer token from the Authorization header */
export function authMiddleware(req: NextRequest): JwtPayload | null {
  try {
    const authHeader = req.headers.get('authorization') || ''
    if (!authHeader.startsWith('Bearer ')) return null
    const token = authHeader.slice(7)
    return verifyAccessToken(token)
  } catch {
    return null
  }
}

/** Return 401 JSON response */
export function unauthorized(message = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 })
}
