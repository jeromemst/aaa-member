import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generatePolicyNumber(): string {
  const prefix = 'POL'
  const year = new Date().getFullYear()
  const random = Math.floor(Math.random() * 9000000) + 1000000
  return `${prefix}-${year}-${random}`
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(date))
}

export function getPlanTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    HEALTH: 'Health Insurance',
    AUTO: 'Auto Insurance',
    LIFE: 'Life Insurance',
    HOME: 'Home Insurance',
  }
  return labels[type] ?? type
}

export function getPlanTypeColor(type: string): string {
  const colors: Record<string, string> = {
    HEALTH: 'bg-blue-100 text-blue-800',
    AUTO: 'bg-green-100 text-green-800',
    LIFE: 'bg-purple-100 text-purple-800',
    HOME: 'bg-orange-100 text-orange-800',
  }
  return colors[type] ?? 'bg-gray-100 text-gray-800'
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    EXPIRED: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-gray-100 text-gray-800',
    PENDING: 'bg-yellow-100 text-yellow-800',
    SUCCEEDED: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
    REFUNDED: 'bg-blue-100 text-blue-800',
  }
  return colors[status] ?? 'bg-gray-100 text-gray-800'
}
