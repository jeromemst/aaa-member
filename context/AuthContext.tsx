'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useRouter } from 'next/navigation'

interface Member {
  id: string
  email: string
  firstName: string
  lastName: string
}

interface AuthContextType {
  member: Member | null
  accessToken: string | null
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => Promise<void>
  isLoading: boolean
}

interface RegisterData {
  email: string
  password: string
  firstName: string
  lastName: string
  phone?: string
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<Member | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Restore session from localStorage on mount
    const storedToken = localStorage.getItem('accessToken')
    const storedMember = localStorage.getItem('member')
    if (storedToken && storedMember) {
      setAccessToken(storedToken)
      setMember(JSON.parse(storedMember))
    }
    setIsLoading(false)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error ?? 'Login failed')
    }
    const data = await res.json()
    setAccessToken(data.accessToken)
    setMember(data.member)
    localStorage.setItem('accessToken', data.accessToken)
    localStorage.setItem('refreshToken', data.refreshToken)
    localStorage.setItem('member', JSON.stringify(data.member))
    router.push('/dashboard')
  }, [router])

  const register = useCallback(async (formData: RegisterData) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error ?? 'Registration failed')
    }
    const data = await res.json()
    setAccessToken(data.accessToken)
    setMember(data.member)
    localStorage.setItem('accessToken', data.accessToken)
    localStorage.setItem('refreshToken', data.refreshToken)
    localStorage.setItem('member', JSON.stringify(data.member))
    router.push('/dashboard')
  }, [router])

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem('refreshToken')
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {})
    setAccessToken(null)
    setMember(null)
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('member')
    router.push('/login')
  }, [router])

  return (
    <AuthContext.Provider value={{ member, accessToken, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
