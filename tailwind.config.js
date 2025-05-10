/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{js,jsx,ts,tsx,html}"], 
  theme: {
    extend: {
      fontFamily: {
        rubik: ["Rubik", "sans-serif"],
      },
      colors: {
        fuchsia900: "#6C3483",
        cyan700: "#1F618D",
      },
      backgroundImage: {
        "gradient-to-l": "linear-gradient(to left, #6C3483, #1F618D)",
      },
    },
  },
  plugins: [],
}
