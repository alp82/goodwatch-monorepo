/** @type {import('tailwindcss').Config} */
const colors = require('tailwindcss/colors')

module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  plugins: [
    require('@tailwindcss/aspect-ratio'),
    require('@tailwindcss/forms'),
    require('@tailwindcss/line-clamp'),
    require('@tailwindcss/typography'),
  ],
  theme: {
    extend: {
      colors: {
        gray: {
          950: '#060606',
        },
        vibe: {
          0: '#D61F1F',
          10: '#D61F1F',
          30: '#D61F1F',
          40: '#e06032',
          50: '#e09832',
          60: '#c7c70b',
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