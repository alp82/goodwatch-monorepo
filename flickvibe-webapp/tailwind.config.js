/** @type {import('tailwindcss').Config} */
const colors = require('tailwindcss/colors')

module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  plugins: [
    require('@tailwindcss/forms'),
  ],
  theme: {
    extend: {
      colors: {
        vibe: {
          0: '#D61F1F',
          10: '#D61F1F',
          30: '#D61F1F',
          40: '#E03C32',
          50: '#E03C32',
          60: '#FFD301',
          70: '#7BB662',
          80: '#639754',
          90: '#006B3D',
          100: '#006B3D',
        },
        imdb: '#f6c800',
        metacritic: '#010101',
        rotten: '#f83309',
      }
    },
  },
  safelist: [
    { pattern: /bg-vibe-[0-9]+/ },
  ],
}