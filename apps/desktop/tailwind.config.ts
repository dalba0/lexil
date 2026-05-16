import type { Config } from "tailwindcss";

// All visual tokens live as CSS variables in src/styles/globals.css.
// Tailwind reads them via var(--token), so utility classes follow the active
// theme without a JS re-render. The `data-theme` attribute on <html> swaps
// the underlying variable set.
const config: Config = {
  darkMode: ["selector", '[data-theme="ink"]'],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        border: "var(--border)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        faint: "var(--faint)",
        accent: "var(--accent)",
        highlight: "var(--highlight)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: [
          "Source Serif 4",
          "Source Serif Pro",
          "ui-serif",
          "Georgia",
          "serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
      },
      fontSize: {
        // tokens from docs/DESIGN.md — do not invent new sizes inline
        display: ["48px", { lineHeight: "56px", fontWeight: "400" }],
        h1: ["28px", { lineHeight: "36px", fontWeight: "600" }],
        h2: ["20px", { lineHeight: "28px", fontWeight: "600" }],
        body: ["15px", { lineHeight: "24px", fontWeight: "400" }],
        "body-sm": ["13px", { lineHeight: "20px", fontWeight: "400" }],
        caption: [
          "12px",
          {
            lineHeight: "16px",
            fontWeight: "500",
            letterSpacing: "0.06em",
          },
        ],
        mono: ["14px", { lineHeight: "20px", fontWeight: "400" }],
      },
      borderRadius: {
        input: "6px",
        card: "8px",
        tag: "4px",
      },
      transitionDuration: {
        fast: "100ms",
        base: "150ms",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
