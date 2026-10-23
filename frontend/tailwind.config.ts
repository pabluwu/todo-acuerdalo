import typography from '@tailwindcss/typography';
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['var(--font-inter)', 'system-ui', 'sans-serif'] },
      colors: { accent: { DEFAULT: '#4f46e5', hover: '#4338ca', soft: '#eef2ff' } },
    },
  },
  plugins: [typography],
};
export default config;
