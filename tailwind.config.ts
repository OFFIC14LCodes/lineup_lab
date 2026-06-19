import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#060708",
        panel: "#14181d",
        panel2: "#1b2026",
        line: "#1e2d4a",      // updated: amber-brown → blue-steel
        electric: "#1a6efc",  // primary accent: matches logo SVG
        brand: "#d3aa59",     // kept: preserves war-room gold semantics
        gold: "#c9a45c"
      },
      boxShadow: {
        glow: "0 24px 80px rgba(26, 110, 252, 0.22)"
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Consolas", "monospace"]
      }
    }
  },
  plugins: []
};

export default config;
