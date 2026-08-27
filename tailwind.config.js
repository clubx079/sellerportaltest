/** @type {import('tailwindcss').Config} */
const plugin = require('tailwindcss/plugin')

// DeelMap BW-retro design tokens (Brand Guidelines v1.0 / docs/BRAND_UI.md).
// Strictly monochrome — legacy token names (primary, brandRed, status.*) are
// remapped onto the grey ramp so existing class usage stays valid.
module.exports = {
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './app/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#111111',
        body: '#171717',
        coal: { DEFAULT: '#0a0a0a', card: '#151515', line: '#3a3a3a', shadow: '#2b2b2b' },
        smoke: { 2: '#444444', 3: '#555555', 4: '#666666' },
        muted: '#757575',
        mist: '#a3a3a3',
        shadowgrey: '#bdbdbd',
        line: { DEFAULT: '#cccccc', 2: '#dddddd' },
        hairline: { DEFAULT: '#e5e5e5', 2: '#ececec', 3: '#ededed' },
        tint: { DEFAULT: '#f2f2f2', 2: '#f7f7f7', 3: '#fafafa' },
        // ---- legacy aliases (old red brand -> ink system) ----
        primary: {
          DEFAULT: '#111111',
          50: '#fafafa', 100: '#f7f7f7', 200: '#f2f2f2', 300: '#e5e5e5',
          400: '#a3a3a3', 500: '#111111', 600: '#444444', 700: '#171717',
          800: '#171717', 900: '#111111',
        },
        secondary: {
          DEFAULT: '#444444',
          50: '#fafafa', 100: '#f7f7f7', 200: '#f2f2f2', 300: '#e5e5e5',
          400: '#a3a3a3', 500: '#444444', 600: '#555555', 700: '#444444',
          800: '#171717', 900: '#111111',
        },
        brandRed: { DEFAULT: '#111111', hover: '#444444' },
        // status is value-encoded monochrome: active=ink, draft/pending=muted,
        // sold/expired=mist; light variants are tints
        status: {
          available: '#111111', availableLight: '#f2f2f2',
          draft: '#757575', draftLight: '#f7f7f7',
          sold: '#a3a3a3', soldLight: '#f2f2f2',
          pending: '#757575', pendingLight: '#f7f7f7',
          contract: '#111111', contractLight: '#f2f2f2',
        },
      },
      fontFamily: {
        display: ['var(--font-archivo)', 'Archivo', 'sans-serif'],
        sans: ['var(--font-instrument)', 'Instrument Sans', 'system-ui', 'sans-serif'],
        mono: ['var(--font-plex-mono)', 'IBM Plex Mono', 'monospace'],
        logo: ['var(--font-grotesk)', 'Space Grotesk', 'sans-serif'],
      },
      borderWidth: { 1.5: '1.5px', 2.5: '2.5px' },
      borderRadius: { pill: '999px' },
      boxShadow: {
        'offset-2': '2px 2px 0 #111111',
        'offset-3': '3px 3px 0 #111111',
        'offset-4': '4px 4px 0 #111111',
        'offset-5': '5px 5px 0 #111111',
        'offset-6': '6px 6px 0 #111111',
        'offset-7': '7px 7px 0 #111111',
        'grey-4': '4px 4px 0 #bdbdbd',
        'grey-7': '7px 7px 0 #bdbdbd',
        'dark-4': '4px 4px 0 #2b2b2b',
        'soft-3': '3px 3px 0 rgba(17,17,17,.3)',
        soft: '0 4px 16px rgba(17,17,17,.3)',
        pin: '2.5px 2.5px 0 rgba(17,17,17,.85)',
        // legacy aliases -> hard offset shadows (no blur on brand)
        card: '3px 3px 0 #111111',
        'card-hover': '5px 5px 0 #111111',
      },
      keyframes: {
        dmPulse: {
          '0%': { boxShadow: '2.5px 2.5px 0 rgba(17,17,17,.85), 0 0 0 0 rgba(17,17,17,.4)' },
          '70%': { boxShadow: '2.5px 2.5px 0 rgba(17,17,17,.85), 0 0 0 14px rgba(17,17,17,0)' },
          '100%': { boxShadow: '2.5px 2.5px 0 rgba(17,17,17,.85), 0 0 0 0 rgba(17,17,17,0)' },
        },
        dmBlink: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.35' } },
        dmFloat: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-7px)' } },
      },
      animation: {
        'pin-pulse': 'dmPulse 2.4s ease-out infinite',
        'pin-blink': 'dmBlink 1.6s ease-in-out infinite',
        'card-float': 'dmFloat 4s ease-in-out infinite',
      },
      transitionDuration: { 120: '120ms' },
    },
  },
  plugins: [
    plugin(({ addUtilities }) => {
      addUtilities({
        '.text-stroke-ink': { '-webkit-text-stroke': '2.2px #111111', color: 'transparent' },
        '.text-stroke-ink-sm': { '-webkit-text-stroke': '1.8px #111111', color: 'transparent' },
        '.text-stroke-paper': { '-webkit-text-stroke': '2px #ffffff', color: 'transparent' },
        '.bg-stripes': {
          backgroundImage: 'repeating-linear-gradient(45deg,#e6e6e6,#e6e6e6 12px,#f1f1f1 12px,#f1f1f1 24px)',
        },
        '.bg-stripes-backdrop': {
          backgroundImage: 'repeating-linear-gradient(45deg,#e4e4e4,#e4e4e4 14px,#ececec 14px,#ececec 28px)',
        },
      })
    }),
  ],
}
