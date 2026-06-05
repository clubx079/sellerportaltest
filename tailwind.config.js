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
          // DeelMap brand (aligned with deelmap-buyer)
          primary: {
            DEFAULT: '#D03839',
            50: '#fef2f2',
            100: '#fde8e8',
            200: '#fbd5d5',
            300: '#f8b4b4',
            400: '#f28686',
            500: '#D03839',
            600: '#E0493B',
            700: '#b91c1c',
            800: '#991b1b',
            900: '#7f1d1d',
          },
          secondary: {
            DEFAULT: '#E0493B',
            50: '#fef2f1',
            100: '#fde8e6',
            200: '#fbd1cd',
            300: '#f8aba5',
            400: '#f27a72',
            500: '#E0493B',
            600: '#c73a2d',
            700: '#a62d22',
            800: '#882520',
            900: '#71211e',
          },
          // Pin/logo accent (red) - used for MapPin icon beside "DeelMap"
          brandRed: {
            DEFAULT: '#D03839',
            hover: '#E0493B',
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