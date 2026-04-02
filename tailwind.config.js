/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'euro-dark': '#001A41',
        'euro-gold': '#EAB308',
      }
    },
  },
  plugins: [],
}
