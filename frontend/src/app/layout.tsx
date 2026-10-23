import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Acuérdalo', template: '%s · Acuérdalo' },
  description: 'Tareas en equipo, sin ruido.',
  appleWebApp: { capable: true, title: 'Acuérdalo', statusBarStyle: 'default' },
  icons: { apple: '/icons/apple-touch-icon.png' },
};

// viewport-fit=cover hace que env(safe-area-inset-bottom) valga algo en iPhone
export const viewport: Viewport = { viewportFit: 'cover', themeColor: '#4f46e5' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
