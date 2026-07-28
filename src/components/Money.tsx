'use client'

import { useMoneyVisibility } from '@/contexts/MoneyVisibilityContext'

interface MoneyProps {
  value: number
  className?: string
}

export default function Money({ value, className }: MoneyProps) {
  const { visible } = useMoneyVisibility()
  return (
    <span className={className}>
      {visible ? value.toLocaleString() : '******'}
    </span>
  )
}

export function MoneyToggle() {
  const { visible, toggle } = useMoneyVisibility()
  return (
    <button
      onClick={toggle}
      title={visible ? 'Hide Figures' : 'Show Figures'}
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors shrink-0"
      style={{
        background: visible ? '#0C2340' : '#C9A84C',
        color: visible ? '#ffffff' : '#1a1200',
        border: 'none',
      }}
    >
      {visible ? (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          Hide Figures
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          </svg>
          Show Figures
        </>
      )}
    </button>
  )
}
