import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#090d12",
        panel: "#101820",
        panel2: "#14212b",
        line: "#243341",
        forge: "#18c08f",
        gold: "#f5b642"
      },
      boxShadow: {
        glow: "0 20px 80px rgba(24, 192, 143, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
