import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { AppLayout } from '@/components/layout/app-layout'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'EIPL Terminal',
  description: 'Terminal operations platform for petroleum/LPG/chemical terminals',
  manifest: '/manifest.json',
  icons: {
    icon: '/images/eipl-logo.jpg',
    apple: '/images/eipl-logo.jpg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <AppLayout>{children}</AppLayout>
        </Providers>
      </body>
    </html>
  )
}
