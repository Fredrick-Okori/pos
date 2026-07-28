'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface MoneyVisibilityContextType {
  visible: boolean
  toggle: () => void
}

const MoneyVisibilityContext = createContext<MoneyVisibilityContextType>({
  visible: true,
  toggle: () => {},
})

export function MoneyVisibilityProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(true)
  return (
    <MoneyVisibilityContext.Provider value={{ visible, toggle: () => setVisible(v => !v) }}>
      {children}
    </MoneyVisibilityContext.Provider>
  )
}

export function useMoneyVisibility() {
  return useContext(MoneyVisibilityContext)
}
