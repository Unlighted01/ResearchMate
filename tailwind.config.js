/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "apple-blue": "#007aff",
        "apple-gray": {
          1: "#8e8e93",
          2: "#636366",
          3: "#48484a",
          4: "#3a3a3c",
          5: "#2c2c2e",
          6: "#1c1c1e",
        },
      },
    },
  },
  plugins: [],
};
