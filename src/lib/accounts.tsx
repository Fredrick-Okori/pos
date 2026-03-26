import { AccountType, AccountConfig } from '@/types'
import { FaMobileAlt, FaSimCard } from 'react-icons/fa'
import { BsCreditCard2Front } from 'react-icons/bs'
import { HiOutlineBanknotes } from 'react-icons/hi2'
import { ReactNode } from 'react'

export const ACCOUNTS: AccountConfig[] = [
  { key: 'airtel_money', label: 'Airtel Account', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800', iconColor: 'text-red-500' },
  { key: 'mtn_money', label: 'MTN Account', color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800', iconColor: 'text-yellow-500' },
  { key: 'visa_card', label: 'Visa Card Account', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800', iconColor: 'text-blue-500' },
  { key: 'cash', label: 'Cash', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800', iconColor: 'text-green-500' },
]

const ACCOUNT_ICONS: Record<AccountType, ReactNode> = {
  airtel_money: <FaMobileAlt className="w-5 h-5" />,
  mtn_money: <FaSimCard className="w-5 h-5" />,
  visa_card: <BsCreditCard2Front className="w-5 h-5" />,
  cash: <HiOutlineBanknotes className="w-5 h-5" />,
}

export function AccountIcon({ type, className }: { type: AccountType; className?: string }) {
  return <span className={className}>{ACCOUNT_ICONS[type]}</span>
}
