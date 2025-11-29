/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta "Corporate Cyberpunk Lite" del PDF
        'lobo-dark': '#0f172a',    // Fondo Oscuro
        'lobo-neion-red': '#ef4444', // Deuda/Peligro
        'lobo-neon-blue': '#3b82f6', // Activo/Seguridad
        'lobo-gold': '#fbbf24',      // Dinero/Oportunidad
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}