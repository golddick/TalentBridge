import type { Config } from "tailwindcss";

// ---------------------------------------------------------------------------
// TalentBridge design tokens
//
// Color system:
//   ink      #16213D  primary text, headers, dark surfaces
//   canvas   #F6F5F2  app background (warm neutral, not pure white)
//   surface  #FFFFFF  card / panel background
//   border   #DEDCD3  hairline borders and dividers
//   accent   #1F6F6F  brand / primary actions / links (deep teal)
//   accentSoft #E4EFEF background tint for accent chips
//   success  #2F7A4F  Strong Match / Qualified / Confirmed
//   warning  #B07D22  Needs Review / Unclear
//   danger   #B0433F  Not Qualified / Not Found / Reject
//
// Type system:
//   display  Space Grotesk  headings, product name, section titles
//   sans     Inter          body copy, UI labels, dashboard density
//   mono     IBM Plex Mono  evidence quotes, scores, IDs, code
// ---------------------------------------------------------------------------

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#16213D",
        canvas: "#F6F5F2",
        surface: "#FFFFFF",
        border: "#DEDCD3",
        accent: {
          DEFAULT: "#1F6F6F",
          soft: "#E4EFEF",
          hover: "#175656",
        },
        success: {
          DEFAULT: "#2F7A4F",
          soft: "#E6F1E9",
        },
        warning: {
          DEFAULT: "#B07D22",
          soft: "#F6EDDC",
        },
        danger: {
          DEFAULT: "#B0433F",
          soft: "#F6E4E3",
        },
        muted: "#6B7280",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        sans: ["var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "14px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(22, 33, 61, 0.06), 0 1px 1px rgba(22, 33, 61, 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
