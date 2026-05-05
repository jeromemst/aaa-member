'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils'
import SaveCardModal from '@/components/SaveCardModal'

interface PaymentMethod {
  id: string
  last4: string
  brand: string
  expMonth: number
  expYear: number
  isDefault: boolean
}

interface Policy {
  id: string
  policyNumber: string
  status: string
  plan: { name: string; type: string; premium: number }
  autoPaySetting?: { enabled: boolean; paymentMethodId?: string } | null
}

interface BillingRecord {
  id: string
  amount: number
  status: string
  description: string
  paidAt: string
  createdAt: string
  policy: { plan: { name: string } }
}

interface Pagination {
  page: number
  totalPages: number
  total: number
}

const CARD_BRAND_ICONS: Record<string, string> = {
  visa: '💙',
  mastercard: '🔴',
  amex: '🔵',
  discover: '🟠',
}

export default function BillingPage() {
  const { accessToken } = useAuth()
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [policies, setPolicies] = useState<Policy[]>([])
  const [billing, setBilling] = useState<BillingRecord[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, totalPages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showSaveCardModal, setShowSaveCardModal] = useState(false)

  const headers = { Authorization: `Bearer ${accessToken}` }

  function fetchAll(page = 1) {
    if (!accessToken) return
    Promise.all([
      fetch('/api/billing/payment-methods', { headers }).then(r => r.json()),
      fetch('/api/policies', { headers }).then(r => r.json()),
      fetch(`/api/billing/history?page=${page}&limit=8`, { headers }).then(r => r.json()),
    ]).then(([pm, pol, bh]) => {
      setPaymentMethods(pm.paymentMethods ?? [])
      setPolicies((pol.policies ?? []).filter((p: Policy) => p.status === 'ACTIVE'))
      setBilling(bh.records ?? [])
      setPagination(bh.pagination ?? { page: 1, totalPages: 1, total: 0 })
    }).finally(() => setLoading(false))
  }

  useEffect(() => { fetchAll() }, [accessToken])

  function handleSaveCard() {
    setShowSaveCardModal(true)
  }

  function handleCardSaved() {
    setShowSaveCardModal(false)
    setMessage({ type: 'success', text: 'Card saved successfully!' })
    fetchAll()
  }

  // kept for legacy reference — no longer used directly
  async function _handleSaveCardLegacy() {
    setActionLoading('save-card')
    setMessage(null)
    try {
      // no-op placeholder
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDeleteCard(id: string) {
    if (!confirm('Remove this payment method?')) return
    setActionLoading('delete-' + id)
    setMessage(null)
    try {
      const res = await fetch(`/api/billing/payment-methods/${id}`, {
        method: 'DELETE',
        headers,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMessage({ type: 'success', text: 'Card removed.' })
      fetchAll()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setActionLoading(null)
    }
  }

  async function handleToggleAutoPay(policy: Policy) {
    setMessage(null)
    if (policy.autoPaySetting?.enabled) {
      // Disable
      setActionLoading('autopay-' + policy.id)
      try {
        const res = await fetch(`/api/billing/autopay/${policy.id}`, { method: 'DELETE', headers })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setMessage({ type: 'success', text: 'Auto-pay disabled.' })
        fetchAll()
      } catch (err: any) {
        setMessage({ type: 'error', text: err.message })
      } finally {
        setActionLoading(null)
      }
    } else {
      // Enable
      if (paymentMethods.length === 0) {
        setMessage({ type: 'error', text: 'Please add a payment method first.' })
        return
      }
      const defaultPm = paymentMethods.find(p => p.isDefault) ?? paymentMethods[0]
      setActionLoading('autopay-' + policy.id)
      try {
        const res = await fetch('/api/billing/autopay', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ policyId: policy.id, paymentMethodId: defaultPm.id }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setMessage({ type: 'success', text: 'Auto-pay enabled!' })
        fetchAll()
      } catch (err: any) {
        setMessage({ type: 'error', text: err.message })
      } finally {
        setActionLoading(null)
      }
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>
  )

  return (
    <div>
      {showSaveCardModal && accessToken && (
        <SaveCardModal
          accessToken={accessToken}
          onSuccess={handleCardSaved}
          onClose={() => setShowSaveCardModal(false)}
        />
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Billing & Payments</h1>
        <p className="text-gray-500 mt-1">Manage your payment methods, auto-pay, and billing history.</p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Payment Methods */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-semibold text-gray-900">Payment Methods</h2>
            <button
              onClick={handleSaveCard}
              disabled={actionLoading === 'save-card'}
              className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              + Add Card
            </button>
          </div>
          <div className="p-4 space-y-3">
            {paymentMethods.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400 text-sm mb-3">No payment methods saved</p>
                <button onClick={handleSaveCard} className="text-sm text-indigo-600 hover:underline">Add a card →</button>
              </div>
            ) : paymentMethods.map(pm => (
              <div key={pm.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{CARD_BRAND_ICONS[pm.brand.toLowerCase()] ?? '💳'}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900 capitalize">{pm.brand} •••• {pm.last4}</p>
                    <p className="text-xs text-gray-500">Expires {pm.expMonth}/{pm.expYear}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {pm.isDefault && (
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Default</span>
                  )}
                  <button
                    onClick={() => handleDeleteCard(pm.id)}
                    disabled={actionLoading === 'delete-' + pm.id}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Auto-pay */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Auto-Pay Settings</h2>
            <p className="text-xs text-gray-500 mt-1">Automatically renew policies on due date</p>
          </div>
          <div className="p-4 space-y-3">
            {policies.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">No active policies</p>
            ) : policies.map(policy => (
              <div key={policy.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-900">{policy.plan.name}</p>
                  <p className="text-xs text-gray-500">{formatCurrency(policy.plan.premium)}/mo · #{policy.policyNumber}</p>
                </div>
                <button
                  onClick={() => handleToggleAutoPay(policy)}
                  disabled={actionLoading === 'autopay-' + policy.id}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                    policy.autoPaySetting?.enabled ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    policy.autoPaySetting?.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Billing History */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Billing History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {billing.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-10 text-center text-gray-400 text-sm">No payment history yet</td></tr>
              ) : billing.map(record => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{record.description}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDate(record.paidAt || record.createdAt)}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{formatCurrency(record.amount)}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getStatusColor(record.status)}`}>
                      {record.status.toLowerCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 flex justify-between items-center">
            <p className="text-sm text-gray-500">{pagination.total} total records</p>
            <div className="flex gap-2">
              <button
                onClick={() => fetchAll(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-3 py-1 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm text-gray-700">Page {pagination.page} of {pagination.totalPages}</span>
              <button
                onClick={() => fetchAll(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-1 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
