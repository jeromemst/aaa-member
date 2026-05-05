'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { formatCurrency, getPlanTypeColor, getPlanTypeLabel } from '@/lib/utils'
import EnrollModal from '@/components/EnrollModal'

interface Plan {
  id: string
  name: string
  type: string
  description: string
  premium: number
  coverageAmount: number
  deductible: number
  billingCycle: string
  features: string[]
}

const PLAN_TYPES = ['ALL', 'HEALTH', 'AUTO', 'LIFE', 'HOME']

export default function PlansPage() {
  const { accessToken } = useAuth()
  const [plans, setPlans] = useState<Plan[]>([])
  const [filter, setFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [enrollingPlan, setEnrollingPlan] = useState<Plan | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!accessToken) return
    const url = filter === 'ALL' ? '/api/plans' : `/api/plans?type=${filter}`
    fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json())
      .then(data => setPlans(data.plans ?? []))
      .finally(() => setLoading(false))
  }, [accessToken, filter])

  function handleEnrollSuccess(policy: any) {
    setEnrollingPlan(null)
    setMessage({ type: 'success', text: `✅ Enrolled! Policy #${policy.policyNumber} is now active.` })
  }

  return (
    <div>
      {enrollingPlan && accessToken && (
        <EnrollModal
          plan={enrollingPlan}
          accessToken={accessToken}
          onSuccess={handleEnrollSuccess}
          onClose={() => setEnrollingPlan(null)}
        />
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Browse Insurance Plans</h1>
        <p className="text-gray-500 mt-1">Choose the coverage that&apos;s right for you.</p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {PLAN_TYPES.map(type => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === type ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {type === 'ALL' ? 'All Plans' : getPlanTypeLabel(type)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          {plans.map(plan => (
            <div key={plan.id} className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
              <div className="p-6 flex-1">
                <div className="flex justify-between items-start mb-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getPlanTypeColor(plan.type)}`}>
                    {getPlanTypeLabel(plan.type)}
                  </span>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-gray-900">{formatCurrency(plan.premium)}</span>
                    <span className="text-gray-400 text-sm">/mo</span>
                  </div>
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-2">{plan.name}</h3>
                <p className="text-sm text-gray-500 mb-4">{plan.description}</p>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Coverage</p>
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(plan.coverageAmount)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Deductible</p>
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(plan.deductible)}</p>
                  </div>
                </div>

                <ul className="space-y-1.5">
                  {(plan.features as string[]).map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-6 pt-0">
                <button
                  onClick={() => setEnrollingPlan(plan)}
                  className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  Enroll Now
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
