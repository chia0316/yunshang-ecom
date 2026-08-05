/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand accent — used sparingly (badges, links, active states), not
        // as the primary button color. Primary buttons/header use the
        // built-in `stone` scale (warm near-black) instead.
        terracotta: {
          50: '#FBF0ED',
          100: '#F5DDD6',
          200: '#E8BDAF',
          300: '#D99880',
          400: '#CB7A64',
          500: '#B5533C',
          600: '#9F4632',
          700: '#853A29',
        },
      },
    },
  },
  plugins: [],
};
