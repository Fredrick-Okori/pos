import type { Metadata } from 'next'
import { Outfit } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { OrganizationProvider } from '@/contexts/OrganizationContext'
import { Toaster } from 'react-hot-toast'

const outfit = Outfit({ subsets: ['latin'] })

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
      <body className={outfit.className}>
        <ThemeProvider>
          <AuthProvider>
            <OrganizationProvider>
              {children}
              <Toaster
                position="top-right"
                toastOptions={{
                  className: 'dark:bg-gray-800 dark:text-white',
                }}
              />
            </OrganizationProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
