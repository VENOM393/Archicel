import type { Metadata, Viewport } from 'next';
import { Outfit } from 'next/font/google';

import { ProveedorSesion } from '@/lib/firebase/sesion';
import { ProveedorUI } from '@/lib/ui/contexto';
import './globals.css';
import '@/styles/archicel.css';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '600', '700', '800'],
  variable: '--font-outfit',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Archicel',
  description: 'El panel de estudio de Celeste',
};

export const viewport: Viewport = {
  themeColor: '#0A1317',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={outfit.variable}>
      <body>
        <ProveedorSesion>
          <ProveedorUI>{children}</ProveedorUI>
        </ProveedorSesion>
      </body>
    </html>
  );
}
