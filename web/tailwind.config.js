/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FFF7ED",
        ink: "#1C1917",
        coral: "#F97316",
        pink: "#EC4899",
        teal: "#0D9488",
        violet: "#7C3AED",
        sky: "#2563EB",
        amber: "#F59E0B",
      },
      fontFamily: {
        heading: ["var(--font-heading)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
    },
  },
  plugins: [],
};
