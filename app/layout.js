// app/layout.js
import './globals.css'
import { Open_Sans, DM_Sans } from 'next/font/google'
import DashboardLayout from '@/components/layout/DashboardLayout'

const openSans = Open_Sans({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700', '800'] })
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' })

export const metadata = {
  title: 'Deelmap Seller Dashboard',
  description: 'Property management platform for real estate sellers',
  icons: {
    icon: '/assets/favicon.ico',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${openSans.className} ${dmSans.variable}`}>
        <DashboardLayout>
          {children}
        </DashboardLayout>
      </body>
    </html>
  )
}