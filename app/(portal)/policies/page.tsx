'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { formatCurrency, formatDate, getPlanTypeColor, getPlanTypeLabel, getStatusColor } from '@/lib/utils'

interface Policy {
  id: string
  policyNumber: string
  status: string
  startDate: string
  renewalDate: string
  plan: { id: string; name: string; type: string; premium: number; coverageAmount: number }
  autoPaySetting?: { enabled: boolean; paymentMethod?: { last4: string; brand: string } } | null
}

export default function PoliciesPage() {
  const { accessToken } = useAuth()
  const [policies, setPolicies] = useState<Policy[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function fetchPolicies() {
    if (!accessToken) return
    fetch('/api/policies', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json())
      .then(data => setPolicies(data.policies ?? []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchPolicies() }, [accessToken])

  async function handleRenew(policyId: string) {
    setMessage(null)
    setActionLoading(policyId + '-renew')
    try {
      const res = await fetch(`/api/policies/${policyId}/renew`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMessage({ type: 'success', text: 'Policy renewed successfully!' })
      fetchPolicies()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setActionLoading(null)
    }
  }

  async function handleCancel(policyId: string, policyNumber: string) {
    if (!confirm(`Cancel policy ${policyNumber}? This cannot be undone.`)) return
    setMessage(null)
    setActionLoading(policyId + '-cancel')
    try {
      const res = await fetch(`/api/policies/${policyId}/cancel`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMessage({ type: 'success', text: 'Policy cancelled.' })
      fetchPolicies()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>
  )

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Policies</h1>
          <p className="text-gray-500 mt-1">Manage your active insurance policies.</p>
        </div>
        <Link href="/plans" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
          + Add Policy
        </Link>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {policies.length === 0 ? (
        <div className="text-center bg-white rounded-xl p-12 shadow-sm border border-gray-200">
          <div className="text-5xl mb-4">🛡️</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No policies yet</h3>
          <p className="text-gray-500 mb-6">Browse our plans and get covered today.</p>
          <Link href="/plans" className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
            Browse Plans
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {policies.map(policy => (
            <div key={policy.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getPlanTypeColor(policy.plan.type)}`}>
                      {getPlanTypeLabel(policy.plan.type)}
                    </span>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getStatusColor(policy.status)}`}>
                      {policy.status.toLowerCase()}
                    </span>
                    {policy.autoPaySetting?.enabled && (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 font-medium">
                        Auto-pay on
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-semibold text-gray-900">{policy.plan.name}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">Policy #{policy.policyNumber}</p>

                  <div className="grid grid-cols-4 gap-4 mt-4">
                    <div>
                      <p className="text-xs text-gray-400">Monthly Premium</p>
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(policy.plan.premium)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Coverage</p>
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(policy.plan.coverageAmount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Start Date</p>
                      <p className="text-sm font-semibold text-gray-900">{formatDate(policy.startDate)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Renewal Date</p>
                      <p className="text-sm font-semibold text-gray-900">{formatDate(policy.renewalDate)}</p>
                    </div>
                  </div>
                </div>

                {policy.status === 'ACTIVE' && (
                  <div className="flex gap-2 ml-6">
                    <button
                      onClick={() => handleRenew(policy.id)}
                      disabled={actionLoading === policy.id + '-renew'}
                      className="px-3 py-1.5 text-sm bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50"
                    >
                      {actionLoading === policy.id + '-renew' ? '...' : 'Renew'}
                    </button>
                    <Link href="/billing" className="px-3 py-1.5 text-sm bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
                      Auto-pay
                    </Link>
                    <button
                      onClick={() => handleCancel(policy.id, policy.policyNumber)}
                      disabled={actionLoading === policy.id + '-cancel'}
                      className="px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      {actionLoading === policy.id + '-cancel' ? '...' : 'Cancel'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
