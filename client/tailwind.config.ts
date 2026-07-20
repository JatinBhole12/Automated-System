import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#16202a",
        cloud: "#f6f8fb",
        line: "#dce4ee"
      },
      boxShadow: {
        panel: "0 8px 24px rgba(30, 45, 62, 0.06)",
        soft: "0 12px 28px rgba(0, 0, 0, 0.18)"
      }
    }
  },
  plugins: []
} satisfies Config;
