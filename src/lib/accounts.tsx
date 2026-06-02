import { AccountType, AccountConfig } from '@/types'
import Image from 'next/image'
import { ReactNode } from 'react'

export const ACCOUNTS: AccountConfig[] = [
  { key: 'airtel_money', label: 'Airtel Account', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800', iconColor: 'text-red-500' },
  { key: 'mtn_money', label: 'MTN Account', color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800', iconColor: 'text-yellow-500' },
  { key: 'visa_card', label: 'Visa Card Account', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800', iconColor: 'text-blue-500' },
  { key: 'cash', label: 'Cash', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800', iconColor: 'text-green-500' },
]

const ACCOUNT_LOGOS: Record<AccountType, { src: string; alt: string }> = {
  airtel_money: { src: '/Airtel_logo.svg.png', alt: 'Airtel' },
  mtn_money: { src: '/MoMo-logo-1.png', alt: 'MTN MoMo' },
  visa_card: { src: '/Visa_Inc.-Logo.wine.png', alt: 'Visa' },
  cash: { src: '/minimalist-money-logo-design-template-cash-money-for-business-finance-money-investing-logo-vector.jpg', alt: 'Cash' },
}

export function AccountIcon({ type, className, size = 28 }: { type: AccountType; className?: string; size?: number }) {
  const logo = ACCOUNT_LOGOS[type]
  return (
    <span className={className}>
      <Image
        src={logo.src}
        alt={logo.alt}
        width={size}
        height={size}
        className="object-contain"
        style={{ maxHeight: size }}
      />
    </span>
  )
}
