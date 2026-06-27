/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ["'Bebas Neue'", "sans-serif"],
        body:    ["'Inter'",      "sans-serif"],
        mono:    ["'JetBrains Mono'", "monospace"],
      },
      colors: {
        black:   "#0a0a0a",
        dark:    "#111111",
        card:    "#161616",
        card2:   "#1c1c1c",
        line:    "#2a2a2a",
        line2:   "#333333",
        yellow:  "#f5c400",
        yellow2: "#e6b800",
        yellow3: "#ffd93d",
        wht:     "#f0f0f0",
        grey:    "#888888",
        grey2:   "#555555",
        danger:  "#e63946",
        success: "#2ecc71",
      },
      animation: {
        "pulse-dot": "pulseDot 1.4s ease-in-out infinite",
        "slide-up":  "slideUp 0.4s ease both",
        "rep-pop":   "repPop 0.35s cubic-bezier(0.36,0.07,0.19,0.97) both",
        "spin-slow": "spin 8s linear infinite",
      },
      keyframes: {
        pulseDot: {
          "0%,100%": { opacity: "1", transform: "scale(1)" },
          "50%":     { opacity: "0.5", transform: "scale(0.8)" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(16px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        repPop: {
          "0%":   { transform: "scale(1)" },
          "40%":  { transform: "scale(1.35)" },
          "70%":  { transform: "scale(0.95)" },
          "100%": { transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};