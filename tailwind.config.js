/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // We keep this so your current toggle doesn't break during transition!
  theme: {
    extend: {
      colors: {
        // Your existing colors
        'euro-dark': '#001A41',
        'euro-gold': '#EAB308',
        
        // --- NEW: Dynamic Theme Engine Colors ---
        app: {
          main: 'var(--bg-main)',
          card: 'var(--bg-card)',
          border: 'var(--border-subtle)',
          text: 'var(--text-main)',
          muted: 'var(--text-muted)',
          accent: 'var(--accent-primary)',
        }
      }
    },
  },
  plugins: [],
}
