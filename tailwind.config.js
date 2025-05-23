/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/components/**/*.{js,jsx,ts,tsx,html,css}",
    "./index.html"
  ], 
  theme: {
    extend: {
      fontFamily: {
        rubik: ["Biryani"],
      },
    },
  },
  plugins: [],
}
