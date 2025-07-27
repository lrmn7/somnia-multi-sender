import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        pixel: ["VT323", "monospace"],
      },
      colors: {
        brand: {
          orange: "#ff8a00",
          gray: "#8f8f8f",
          dark: "#1a1a1a",
        },
      },
      boxShadow: {
        'pixel-orange': '4px 4px 0px 0px #ff8a00',
        'pixel-orange-sm': '2px 2px 0px 0px #ff8a00',
      },
    },
  },
  plugins: [],
};
export default config;