import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, Fraunces, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { OrganizationProvider } from '@/contexts/OrganizationContext'
import { Toaster } from 'react-hot-toast'

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sans' })
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-serif', axes: ['opsz'] })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'SEIV',
  description: 'Point of Sale System for Daily Sales Reporting',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${jakarta.variable} ${fraunces.variable} ${mono.variable} ${jakarta.className}`}>
        <AuthProvider>
          <OrganizationProvider>
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  background: '#0E1E35',
                  color: '#E8EEF6',
                  border: '1px solid rgba(37,99,168,.3)',
                },
              }}
            />
          </OrganizationProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
