import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b0705",
        table: "#1a0f0a",
        wine: "#3a1115",
        brass: "#b08a4a",
        parchment: "#dcc79b",
        ember: "#d59b4c",
      },
      fontFamily: {
        title: ["Georgia", "Noto Serif SC", "Songti SC", "serif"],
        body: ["Inter", "Noto Sans SC", "Microsoft YaHei", "sans-serif"],
      },
      boxShadow: {
        candle: "0 0 80px rgba(213, 155, 76, 0.28)",
        parchment: "0 18px 70px rgba(0, 0, 0, 0.48)",
      },
    },
  },
  plugins: [],
};

export default config;
