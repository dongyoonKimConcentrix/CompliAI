import type { Config } from "tailwindcss";

const appleTheme = {
  primary: "#1d1d1f",
  "primary-content": "#ffffff",
  secondary: "#86868b",
  "secondary-content": "#ffffff",
  accent: "#424245",
  "accent-content": "#ffffff",
  neutral: "#1d1d1f",
  "neutral-content": "#ffffff",
  "base-100": "#ffffff",
  "base-200": "#f5f5f7",
  "base-300": "#d2d2d7",
  "base-content": "#1d1d1f",
  info: "#86868b",
  "info-content": "#ffffff",
  success: "#424245",
  "success-content": "#ffffff",
  warning: "#6e6e73",
  "warning-content": "#ffffff",
  error: "#1d1d1f",
  "error-content": "#ffffff",
  "--rounded-box": "0.75rem",
  "--rounded-btn": "0.625rem",
  "--rounded-badge": "0.375rem",
  "--animation-btn": "0.2s",
  "--animation-input": "0.2s",
  "--btn-focus-scale": "0.98",
  "--border-btn": "1px",
  "--tab-border": "1px",
  "--tab-radius": "0.5rem",
};

const appleDarkTheme = {
  primary: "#f5f5f7",
  "primary-content": "#1d1d1f",
  secondary: "#86868b",
  "secondary-content": "#f5f5f7",
  accent: "#a1a1a6",
  "accent-content": "#1d1d1f",
  neutral: "#f5f5f7",
  "neutral-content": "#1d1d1f",
  "base-100": "#1d1d1f",
  "base-200": "#2d2d2f",
  "base-300": "#424245",
  "base-content": "#f5f5f7",
  info: "#86868b",
  "info-content": "#f5f5f7",
  success: "#a1a1a6",
  "success-content": "#1d1d1f",
  warning: "#86868b",
  "warning-content": "#f5f5f7",
  error: "#f5f5f7",
  "error-content": "#1d1d1f",
  "--rounded-box": "0.75rem",
  "--rounded-btn": "0.625rem",
  "--rounded-badge": "0.375rem",
  "--animation-btn": "0.2s",
  "--animation-input": "0.2s",
  "--btn-focus-scale": "0.98",
  "--border-btn": "1px",
  "--tab-border": "1px",
  "--tab-radius": "0.5rem",
};

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["GMarketSans", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
      colors: {
        "space-gray": {
          100: "#f5f5f7",
          200: "#e8e8ed",
          300: "#d2d2d7",
          400: "#86868b",
          500: "#6e6e73",
          600: "#424245",
          700: "#2d2d2f",
          800: "#1d1d1f",
        },
      },
      boxShadow: {
        apple: "0 2px 12px rgba(0, 0, 0, 0.08)",
        "apple-lg": "0 4px 24px rgba(0, 0, 0, 0.12)",
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      { apple: appleTheme },
      { "apple-dark": appleDarkTheme },
    ],
  },
};

export default config;
