// app/layout.js
import './globals.css'
import { Inter } from 'next/font/google'
import DashboardLayout from '@/components/layout/DashboardLayout' // <-- New Client Component

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Deelmap Seller Dashboard',
  description: 'Property management platform for real estate sellers',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <DashboardLayout>
          {children}
        </DashboardLayout>
      </body>
    </html>
  )
}