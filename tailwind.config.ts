import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      borderRadius: {
        none: "0",
        sm: "2px",
        DEFAULT: "4px",
        md: "4px",
        lg: "4px",
        xl: "6px",
        "2xl": "8px",
        "3xl": "10px",
        full: "9999px",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        brand: {
          tile: "rgb(var(--brand-tile) / <alpha-value>)",
          navy: "rgb(var(--brand-navy) / <alpha-value>)",
          "navy-deep": "rgb(var(--brand-navy-deep) / <alpha-value>)",
          gold: "rgb(var(--brand-gold) / <alpha-value>)",
          amber: "rgb(var(--brand-amber) / <alpha-value>)",
          white: "rgb(var(--brand-white) / <alpha-value>)",
          slate: "rgb(var(--brand-slate) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "#0F1C2E",
          panel: "#020617",
          raised: "#0a1624",
        },
        paper: "#F4F4F4",
        hairline: "rgb(var(--brand-white) / 0.12)",
        denied: {
          DEFAULT: "rgb(var(--denied) / <alpha-value>)",
          soft: "rgb(var(--denied-soft) / <alpha-value>)",
          muted: "rgb(var(--denied) / 0.12)",
        },
        gate: {
          open: "rgb(var(--brand-amber) / <alpha-value>)",
          closed: "rgb(var(--brand-gold) / <alpha-value>)",
        },
        severity: {
          minor: "#3D7A4A",
          moderate: "#C6A85B",
          severe: "#C45C26",
          critical: "#8B0000",
        },
      },
      boxShadow: {
        none: "none",
        sm: "none",
        DEFAULT: "none",
        md: "none",
        lg: "none",
        xl: "none",
        "2xl": "none",
        gold: "none",
        amber: "0 0 28px rgba(232, 184, 74, 0.16)",
        panel: "0 16px 48px rgba(2, 6, 23, 0.45)",
      },
      spacing: {
        safe: "env(safe-area-inset-bottom)",
        "safe-top": "env(safe-area-inset-top)",
      },
      minHeight: {
        touch: "44px",
        dvh: "100dvh",
      },
      minWidth: {
        touch: "44px",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "gate-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
        "fade-in": "fade-in 0.25s ease-out",
        "gate-pulse": "gate-pulse 2.2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate"),
    plugin(({ addVariant }) => {
      addVariant("light", '[data-theme="light"] &');
    }),
  ],
};

export default config;
