import type { Config } from "tailwindcss";

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
        sm: "4px",
        DEFAULT: "6px",
        md: "6px",
        lg: "10px",
        xl: "14px",
        "2xl": "18px",
        "3xl": "24px",
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
          navy: "#0F1C2E",
          "navy-deep": "#020617",
          gold: "#C6A85B",
          amber: "#E8B84A",
          white: "#F4F4F4",
          slate: "#8B95A5",
        },
        ink: {
          DEFAULT: "#0F1C2E",
          panel: "#020617",
          raised: "#0a1624",
        },
        paper: "#F4F4F4",
        hairline: "rgba(244, 244, 244, 0.12)",
        denied: {
          DEFAULT: "#E89090",
          soft: "#F5C4C4",
          muted: "rgba(232, 144, 144, 0.12)",
        },
        gate: {
          open: "#E8B84A",
          closed: "#C6A85B",
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
        gold: "0 0 24px rgba(198, 168, 91, 0.08)",
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
        "fade-in": "fade-in 0.25s ease-out",
        "gate-pulse": "gate-pulse 2.2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
