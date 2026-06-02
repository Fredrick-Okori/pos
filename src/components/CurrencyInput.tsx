'use client'

import { useState, useEffect, useRef } from 'react'

interface CurrencyInputProps {
  value: number
  onValueChange: (value: number) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  autoFocus?: boolean
}

function addCommas(intStr: string): string {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function toDisplay(num: number): string {
  if (!num) return ''
  const [int, dec] = num.toString().split('.')
  return dec ? addCommas(int) + '.' + dec : addCommas(int)
}

export default function CurrencyInput({ value, onValueChange, placeholder, className, disabled, autoFocus }: CurrencyInputProps) {
  const [display, setDisplay] = useState(() => toDisplay(value))
  const lastReported = useRef(value)

  // Sync display when value is changed externally (e.g. "Pay in Full" button)
  useEffect(() => {
    if (value !== lastReported.current) {
      lastReported.current = value
      setDisplay(toDisplay(value))
    }
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, '')
    if (raw !== '' && !/^\d*\.?\d*$/.test(raw)) return
    const [int, dec] = raw.split('.')
    let formatted = addCommas(int || '')
    if (dec !== undefined) formatted += '.' + dec
    if (raw === '') formatted = ''
    setDisplay(formatted)
    const num = parseFloat(raw) || 0
    lastReported.current = num
    onValueChange(num)
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      placeholder={placeholder ?? ''}
      className={className}
      disabled={disabled}
      autoFocus={autoFocus}
    />
  )
}
