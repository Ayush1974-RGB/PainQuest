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
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
        display: ["'Inter'", "sans-serif"],
      },
      colors: {
        void: "#03060f",
        deep: "#060d1a",
        panel: "#0a1628",
        panel2: "#0d1e35",
        border: "#152240",
        border2: "#1e3358",
        accent: {
          cyan: "#00e5ff",
          "cyan-dim": "#00b8cc",
          green: "#00ff88",
          amber: "#ffb800",
          red: "#ff3b5c",
          purple: "#a855f7",
        },
        muted: "#3d5a7a",
        muted2: "#2a3f5a",
        txt: "#e2eeff",
        "txt-dim": "#8aaac8",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow": "spin 6s linear infinite",
        float: "float 3s ease-in-out infinite",
        blink: "blink 1s step-end infinite",
        "border-rotate": "borderRotate 4s ease infinite",
        "fade-in": "fadeIn 0.5s ease forwards",
        "slide-up": "slideUp 0.4s ease forwards",
      },
      keyframes: {
        float: {
          "0%,100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        blink: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0" } },
        borderRotate: {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
