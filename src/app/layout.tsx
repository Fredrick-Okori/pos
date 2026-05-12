import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, Fraunces, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { OrganizationProvider } from '@/contexts/OrganizationContext'
import { Toaster } from 'react-hot-toast'

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sans' })
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-serif', axes: ['opsz'] })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'Krug POS System',
  description: 'Point of Sale System for Daily Sales Reporting',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${jakarta.variable} ${fraunces.variable} ${mono.variable} ${jakarta.className}`}>
        <ThemeProvider>
          <AuthProvider>
            <OrganizationProvider>
              {children}
              <Toaster
                position="top-right"
                toastOptions={{
                  className: 'dark:bg-navy-850 dark:text-white',
                }}
              />
            </OrganizationProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
