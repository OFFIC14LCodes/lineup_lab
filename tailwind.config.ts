import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#060708",
        panel: "#14181d",
        panel2: "#1b2026",
        line: "#4f4433",
        brand: "#d3aa59",
        gold: "#c9a45c"
      },
      boxShadow: {
        glow: "0 24px 80px rgba(201, 164, 92, 0.18)"
      }
    }
  },
  plugins: []
};

export default config;
