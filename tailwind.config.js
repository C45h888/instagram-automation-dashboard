/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          instagram: {
            primary: '#E4405F',
            secondary: '#405DE6',
            accent: '#5B51D8',
          },
          status: {
            success: '#00C851',
            warning: '#FF8800',
            error: '#FF4444',
            info: '#2196F3'
          },
          neutral: {
            50: '#FAFAFA',
            100: '#F5F5F5',
            200: '#EEEEEE',
            500: '#8E8E8E',
            900: '#262626'
          }
        },
        fontFamily: {
          sans: ['Inter', 'system-ui', 'sans-serif']
        },
        spacing: {
          'grid': '8px',
          'component': '16px',
          'section': '32px',
          'page': '64px'
        }
      },
    },
    plugins: [],
  }