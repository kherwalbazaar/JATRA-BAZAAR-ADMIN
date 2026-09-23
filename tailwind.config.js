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
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brandDark: '#0b0f24',
        sidebarDark: '#0f1430',
        cardDark: '#181e42',
        activeNav: '#4f39f6',
        mainBg: '#f4f6fc',
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        glow: '0 0 20px -5px rgba(79, 57, 246, 0.3)',
      }
    },
  },
  plugins: [],
};
