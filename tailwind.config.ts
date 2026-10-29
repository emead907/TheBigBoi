import type { Config } from 'tailwindcss';

// Gym Stars brand: navy #004380, slate #4F6D8A, steel #96ABBD, gray #808080, mist #DEDEE2
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand color comes from the current gym (see app/[gym]/layout.tsx); Gym Stars navy by default.
        navy: { DEFAULT: 'rgb(var(--brand) / <alpha-value>)', 700: 'rgb(var(--brand-700) / <alpha-value>)', 50: 'rgb(var(--brand-50) / <alpha-value>)' },
        accent: 'rgb(var(--accent) / <alpha-value>)',
        slate: { brand: '#4F6D8A' },
        steel: '#96ABBD',
        mist: '#DEDEE2',
        paper: '#f4f5f8',
        stage: {
          wait: '#b07d1a',
          new: '#004380',
          upcoming: '#2f86a3',
          today: '#d9772f',
          follow: '#7a5aa6',
          won: '#2f7d4f',
          lost: '#808080',
        },
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'Impact', '"Arial Narrow"', 'sans-serif'],
        sans: ['Montserrat', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
