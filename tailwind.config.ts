import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/renderer/**/*.{html,ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        text: {
          DEFAULT: "var(--text)",
          muted: "var(--text-muted)",
        },
        accent: "var(--accent)",
        border: "var(--border)",
        "popup-bg": "var(--popup-bg)",
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Arabic"', '"Segoe UI"', "system-ui", "sans-serif"],
        arabic: ['"IBM Plex Sans Arabic"', '"Segoe UI"', "system-ui", "sans-serif"],
      },
      fontSize: {
        "popup-base": ["1.375rem", { lineHeight: "1.7", letterSpacing: "0" }],
        "title-page": ["1.25rem", { lineHeight: "1.4" }],
        body: ["0.875rem", { lineHeight: "1.55" }],
        sidebar: ["0.8125rem", { lineHeight: "1.5" }],
      },
      borderRadius: {
        popup: "16px",
      },
      boxShadow: {
        popup: "0 10px 40px rgba(0,0,0,0.18)",
      },
      backdropBlur: {
        popup: "18px",
      },
      transitionTimingFunction: {
        "soft-out": "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      transitionDuration: {
        80: "80ms",
        120: "120ms",
        400: "400ms",
      },
      keyframes: {
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-out-up": {
          from: { opacity: "1", transform: "translateY(0)" },
          to: { opacity: "0", transform: "translateY(-4px)" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 400ms cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "fade-out-up": "fade-out-up 400ms cubic-bezier(0.22, 1, 0.36, 1) forwards",
      },
    },
  },
  plugins: [],
};

export default config;
