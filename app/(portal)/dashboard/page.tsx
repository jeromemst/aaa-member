'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { formatCurrency, formatDate, getPlanTypeColor, getStatusColor, getPlanTypeLabel } from '@/lib/utils'

interface Policy {
  id: string
  policyNumber: string
  status: string
  startDate: string
  renewalDate: string
  plan: { name: string; type: string; premium: number }
  autoPaySetting?: { enabled: boolean } | null
}

interface BillingRecord {
  id: string
  amount: number
  status: string
  description: string
  paidAt: string
  createdAt: string
}

export default function DashboardPage() {
  const { member, accessToken } = useAuth()
  const [policies, setPolicies] = useState<Policy[]>([])
  const [billing, setBilling] = useState<BillingRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!accessToken) return
    const headers = { Authorization: `Bearer ${accessToken}` }
    Promise.all([
      fetch('/api/policies', { headers }).then(r => r.json()),
      fetch('/api/billing/history?limit=5', { headers }).then(r => r.json()),
    ]).then(([p, b]) => {
      setPolicies(p.policies ?? [])
      setBilling(b.records ?? [])
    }).finally(() => setLoading(false))
  }, [accessToken])

  const activePolicies = policies.filter(p => p.status === 'ACTIVE')
  const monthlyPremium = activePolicies.reduce((sum, p) => sum + p.plan.premium, 0)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>
  )

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {member?.firstName}!</h1>
        <p className="text-gray-500 mt-1">Here&apos;s an overview of your insurance portfolio.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500 mb-1">Active Policies</p>
          <p className="text-3xl font-bold text-gray-900">{activePolicies.length}</p>
          <Link href="/policies" className="text-xs text-indigo-600 mt-2 inline-block hover:underline">View all →</Link>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500 mb-1">Monthly Premiums</p>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(monthlyPremium)}</p>
          <Link href="/billing" className="text-xs text-indigo-600 mt-2 inline-block hover:underline">Billing history →</Link>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500 mb-1">Auto-Pay Enabled</p>
          <p className="text-3xl font-bold text-gray-900">
            {activePolicies.filter(p => p.autoPaySetting?.enabled).length}
          </p>
          <Link href="/billing" className="text-xs text-indigo-600 mt-2 inline-block hover:underline">Manage auto-pay →</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Active Policies */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-semibold text-gray-900">Active Policies</h2>
            <Link href="/policies" className="text-sm text-indigo-600 hover:underline">View all</Link>
          </div>
          <div className="p-4 space-y-3">
            {activePolicies.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400 text-sm mb-3">No active policies yet</p>
                <Link href="/plans" className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
                  Browse Plans
                </Link>
              </div>
            ) : activePolicies.slice(0, 4).map(policy => (
              <div key={policy.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getPlanTypeColor(policy.plan.type)}`}>
                      {getPlanTypeLabel(policy.plan.type)}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">{policy.plan.name}</p>
                  <p className="text-xs text-gray-500">Renews {formatDate(policy.renewalDate)}</p>
                </div>
                <p className="text-sm font-semibold text-gray-700">{formatCurrency(policy.plan.premium)}/mo</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Billing */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-semibold text-gray-900">Recent Payments</h2>
            <Link href="/billing" className="text-sm text-indigo-600 hover:underline">View all</Link>
          </div>
          <div className="p-4 space-y-3">
            {billing.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">No payment history yet</p>
            ) : billing.map(record => (
              <div key={record.id} className="flex items-center justify-between p-3 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">{record.description}</p>
                  <p className="text-xs text-gray-500">{formatDate(record.paidAt || record.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatCurrency(record.amount)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(record.status)}`}>
                    {record.status.toLowerCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
