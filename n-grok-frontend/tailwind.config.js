/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			primary: '#c8ff00',
  			'app-bg': '#050505',
  			secondary: '#888',
  			muted: '#555',
  		},
  		boxShadow: {
  			'glow': '0 0 30px rgba(200, 255, 0, 0.3)',
  			'3xl': '0 35px 60px -15px rgba(0, 0, 0, 0.5)',
  		},
  		animation: {
  			'fade-in-up': 'fadeInUp 0.7s ease-out forwards',
  		},
  		keyframes: {
  			fadeInUp: {
  				'0%': { opacity: '0', transform: 'translateY(20px)' },
  				'100%': { opacity: '1', transform: 'translateY(0)' },
  			},
  		},
  	}
  },
  plugins: [import("tailwindcss-animate")],
}

