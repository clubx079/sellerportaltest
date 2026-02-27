/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      './pages/**/*.{js,jsx}',
      './components/**/*.{js,jsx}',
      './app/**/*.{js,jsx}',
    ],
    theme: {
      extend: {
        colors: {
          // Deelmap brand (aligned with deelmap-buyer)
          primary: {
            DEFAULT: '#022b41',
            50: '#f0f6f9',
            100: '#d9e8ef',
            200: '#b3d1df',
            300: '#8cb9cf',
            400: '#66a2bf',
            500: '#022b41',
            600: '#02263a',
            700: '#012032',
            800: '#011b2b',
            900: '#011523',
          },
          secondary: {
            DEFAULT: '#b29578',
            50: '#f8f6f3',
            100: '#ebe6df',
            200: '#d7cdbf',
            300: '#c3b49f',
            400: '#b29578',
            500: '#9a7e61',
            600: '#826750',
            700: '#6b5342',
            800: '#533f33',
            900: '#3b2b24',
          },
          // Pin/logo accent (red) - used for MapPin icon beside "DeelMap"
          brandRed: {
            DEFAULT: '#DC2626',
            hover: '#B91C1C',
          },
          status: {
            available: '#10B981',
            availableLight: '#ECFDF5',
            draft: '#F59E0B',
            draftLight: '#FFFBEB',
            sold: '#EF4444',
            soldLight: '#FEF2F2',
            pending: '#3B82F6',
            pendingLight: '#EFF6FF',
            contract: '#8B5CF6',
            contractLight: '#F5F3FF',
          }
        },
        fontFamily: {
          sans: ['Open Sans', 'system-ui', '-apple-system', 'sans-serif'],
        },
        boxShadow: {
          'card': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
          'card-hover': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        },
      },
    },
    plugins: [],
  }