// app/layout.js
import './globals.css'
import Script from 'next/script'
import localFont from 'next/font/local'
import DashboardLayout from '@/components/layout/DashboardLayout'

// BW-retro brand type stack — self-hosted static instances (overlap-cleaned so
// the outline-stroke headline treatment renders correctly).
const archivo = localFont({
  src: [
    { path: './fonts/archivo-600.woff2', weight: '600', style: 'normal' },
    { path: './fonts/archivo-650.woff2', weight: '650', style: 'normal' },
    { path: './fonts/archivo-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-archivo',
  display: 'swap',
})
const instrument = localFont({
  src: [
    { path: './fonts/instrument-sans-400.woff2', weight: '400', style: 'normal' },
    { path: './fonts/instrument-sans-500.woff2', weight: '500', style: 'normal' },
    { path: './fonts/instrument-sans-600.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-instrument',
  display: 'swap',
})
const plexMono = localFont({
  src: [
    { path: './fonts/plex-mono-500.woff2', weight: '500', style: 'normal' },
    { path: './fonts/plex-mono-600.woff2', weight: '600', style: 'normal' },
    { path: './fonts/plex-mono-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-plex-mono',
  display: 'swap',
})
const grotesk = localFont({
  src: [{ path: './fonts/space-grotesk-700.woff2', weight: '700', style: 'normal' }],
  variable: '--font-grotesk',
  display: 'swap',
})

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
    // Font variables on <html>: theme tokens reference them at :root — custom
    // properties resolve where DEFINED, so body-scoped variables never reach them.
    <html lang="en" className={`${archivo.variable} ${instrument.variable} ${plexMono.variable} ${grotesk.variable}`}>
      {GTM_ID && (
        <Script id="gtm" strategy="afterInteractive">{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`}</Script>
      )}
      <body className={instrument.className}>
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