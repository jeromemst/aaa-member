'use client'

import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { formatCurrency } from '@/lib/utils'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '15px',
      color: '#111827',
      fontFamily: 'Inter, system-ui, sans-serif',
      '::placeholder': { color: '#9ca3af' },
    },
    invalid: { color: '#ef4444' },
  },
}

interface Plan {
  id: string
  name: string
  type: string
  premium: number
  coverageAmount: number
}

interface EnrollFormProps {
  plan: Plan
  accessToken: string
  onSuccess: (policy: any) => void
  onClose: () => void
}

function EnrollForm({ plan, accessToken, onSuccess, onClose }: EnrollFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setLoading(true)
    setError('')

    const cardElement = elements.getElement(CardElement)
    if (!cardElement) return

    // Create payment method from card details
    const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
    })

    if (pmError) {
      setError(pmError.message ?? 'Card error. Please try again.')
      setLoading(false)
      return
    }

    // Enroll in plan
    const res = await fetch('/api/policies', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ planId: plan.id, paymentMethodId: paymentMethod.id }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Enrollment failed. Please try again.')
      setLoading(false)
      return
    }

    onSuccess(data.policy)
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Plan summary */}
      <div className="bg-indigo-50 rounded-xl p-4 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <p className="font-semibold text-gray-900">{plan.name}</p>
            <p className="text-sm text-gray-500">Coverage up to {formatCurrency(plan.coverageAmount)}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-indigo-700">{formatCurrency(plan.premium)}</p>
            <p className="text-xs text-gray-500">/month</p>
          </div>
        </div>
      </div>

      {/* Card input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Card details</label>
        <div className="border border-gray-300 rounded-lg px-4 py-3 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all">
          <CardElement options={CARD_ELEMENT_OPTIONS} />
        </div>
        <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          Secured by Stripe. We never store your card details.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || loading}
          className="flex-1 bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Processing...
            </span>
          ) : (
            `Pay ${formatCurrency(plan.premium)}/mo`
          )}
        </button>
      </div>
    </form>
  )
}

interface EnrollModalProps {
  plan: Plan
  accessToken: string
  onSuccess: (policy: any) => void
  onClose: () => void
}

export default function EnrollModal({ plan, accessToken, onSuccess, onClose }: EnrollModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Confirm Enrollment</h2>
            <p className="text-sm text-gray-500 mt-0.5">First month charged immediately</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <Elements stripe={stripePromise}>
          <EnrollForm plan={plan} accessToken={accessToken} onSuccess={onSuccess} onClose={onClose} />
        </Elements>
      </div>
    </div>
  )
}
