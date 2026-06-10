/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Tema chiaro: i nomi restano semantici, i valori definiscono l'estetica.
        ink: "#F4F5F7", // sfondo pagina
        panel: "#FFFFFF", // card e pannelli
        line: "#E3E6EB", // bordi e divisori
        muted: "#6B7280", // testo secondario
        paper: "#111827", // testo principale
        op: { DEFAULT: "#059669", dark: "#047857" }, // azione/accento
        warn: "#B45309",
        danger: "#DC2626",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
        // Wordmark AIVOT: serif di lusso (alternativa libera a Tan Pearl)
        brand: ["Prata", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
