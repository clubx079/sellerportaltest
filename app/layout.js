// app/layout.js
import './globals.css'
import Script from 'next/script'
import { Open_Sans, DM_Sans } from 'next/font/google'
import DashboardLayout from '@/components/layout/DashboardLayout'

const openSans = Open_Sans({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700', '800'] })
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' })

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || 'GTM-WVTT9R5P'

export const metadata = {
  title: 'DeelMap Seller Dashboard',
  description: 'Property management platform for real estate sellers',
  icons: {
    icon: '/assets/favicon.ico',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      {GTM_ID && (
        <Script id="gtm" strategy="afterInteractive">{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`}</Script>
      )}
      <body className={`${openSans.className} ${dmSans.variable}`}>
        {GTM_ID && (
          <noscript><iframe src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`} height="0" width="0" style={{ display: 'none', visibility: 'hidden' }} /></noscript>
        )}
        <DashboardLayout>
          {children}
        </DashboardLayout>
      </body>
    </html>
  )
}