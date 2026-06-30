import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: { default: 'Callr', template: '%s · Callr' },
  description: 'Social prediction markets for World Cup football. Powered by TxLINE.',
};

export const viewport: Viewport = {
  themeColor: '#121824',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-canvas antialiased font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
