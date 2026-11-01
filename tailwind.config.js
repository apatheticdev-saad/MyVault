/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/client/**/*.{ts,tsx}"],
  theme: { extend: { fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"] } } },
  plugins: [],
};
