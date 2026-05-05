'use client'

import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'

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

interface SaveCardFormProps {
  accessToken: string
  onSuccess: () => void
  onClose: () => void
}

function SaveCardForm({ accessToken, onSuccess, onClose }: SaveCardFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [setAsDefault, setSetAsDefault] = useState(true)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setLoading(true)
    setError('')

    const cardElement = elements.getElement(CardElement)
    if (!cardElement) return

    // Step 1: Get SetupIntent client secret from our API
    const siRes = await fetch('/api/billing/setup-intent', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    const siData = await siRes.json()
    if (!siRes.ok) {
      setError(siData.error ?? 'Failed to initialise card setup.')
      setLoading(false)
      return
    }

    // Step 2: Confirm card setup with Stripe
    const { error: setupError, setupIntent } = await stripe.confirmCardSetup(
      siData.clientSecret,
      { payment_method: { card: cardElement } }
    )

    if (setupError) {
      setError(setupError.message ?? 'Card setup failed.')
      setLoading(false)
      return
    }

    // Step 3: Save the payment method to our database
    const pmId = typeof setupIntent.payment_method === 'string'
      ? setupIntent.payment_method
      : setupIntent.payment_method?.id

    if (!pmId) {
      setError('Could not retrieve payment method.')
      setLoading(false)
      return
    }

    const saveRes = await fetch('/api/billing/payment-methods', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ stripePaymentMethodId: pmId, setDefault: setAsDefault }),
    })

    const saveData = await saveRes.json()
    if (!saveRes.ok) {
      setError(saveData.error ?? 'Failed to save card.')
      setLoading(false)
      return
    }

    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Card input */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">Card details</label>
        <div className="border border-gray-300 rounded-lg px-4 py-3 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all">
          <CardElement options={CARD_ELEMENT_OPTIONS} />
        </div>
      </div>

      {/* Set as default toggle */}
      <label className="flex items-center gap-3 mb-6 cursor-pointer">
        <input
          type="checkbox"
          checked={setAsDefault}
          onChange={e => setSetAsDefault(e.target.checked)}
          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
        />
        <span className="text-sm text-gray-700">Set as default payment method</span>
      </label>

      <p className="text-xs text-gray-400 mb-5 flex items-center gap-1">
        <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
        </svg>
        Secured by Stripe. Your card details are never stored on our servers.
      </p>

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
              Saving...
            </span>
          ) : 'Save Card'}
        </button>
      </div>
    </form>
  )
}

interface SaveCardModalProps {
  accessToken: string
  onSuccess: () => void
  onClose: () => void
}

export default function SaveCardModal({ accessToken, onSuccess, onClose }: SaveCardModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Add Payment Method</h2>
            <p className="text-sm text-gray-500 mt-0.5">Saved for future payments and auto-pay</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <Elements stripe={stripePromise}>
          <SaveCardForm accessToken={accessToken} onSuccess={onSuccess} onClose={onClose} />
        </Elements>
      </div>
    </div>
  )
}
