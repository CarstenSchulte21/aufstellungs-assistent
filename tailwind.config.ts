import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Vereinsfarbwelt aus dem Prototyp
        primary: {
          DEFAULT: "#123c73",
          light: "#1e5299",
          dark: "#0d2c54",
        },
      },
    },
  },
  plugins: [],
};

export default config;
