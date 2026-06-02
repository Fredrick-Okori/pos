import type { Metadata } from 'next'
import { Fraunces, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { OrganizationProvider } from '@/contexts/OrganizationContext'
import { Toaster } from 'react-hot-toast'

const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-serif', axes: ['opsz'] })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'SEIV',
  description: 'Point of Sale System for Daily Sales Reporting',
  icons: {
    icon: '/siev_gold.png',
    apple: '/siev_gold.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${fraunces.variable} ${mono.variable}`}>
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
