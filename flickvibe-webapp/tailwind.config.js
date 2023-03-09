/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        imdb: '#f6c800',
        metacritic: '#010101',
        rotten: '#f83309',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}