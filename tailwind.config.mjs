/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        primary: '#2a6f97',
        secondary: '#2c7a7b',
        accent: '#f59e0b',
        text: {
          DEFAULT: '#1f2937',
          light: '#334155',
        },
        bg: {
          light: '#f8fafc',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: '70ch',
            lineHeight: '1.65',
            color: '#1f2937',
          },
        },
      },
    },
  },
  plugins: [],
};

