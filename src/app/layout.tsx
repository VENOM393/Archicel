import type { Metadata, Viewport } from 'next';
import { Outfit, Geist } from 'next/font/google';

import { Marco } from '@/components/Marco';
import { ProveedorSesion } from '@/lib/firebase/sesion';
import { ProveedorUI } from '@/lib/ui/contexto';
import { ProveedorMovimiento } from '@/lib/ui/ProveedorMovimiento';
import './globals.css';
import '@/styles/archicel.css';
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '600', '700', '800'],
  variable: '--font-outfit',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Archicel',
  description: 'El panel de estudio de Celeste',
  applicationName: 'Archicel',
  /* Que el titulo de la ventana instalada no cambie de una vista a otra: dentro de un
     programa, la barra pone el nombre del programa y no el de la pantalla. */
  appleWebApp: { capable: true, title: 'Archicel', statusBarStyle: 'black-translucent' },
  icons: { apple: '/apple-touch-icon.png' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#0A1317',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={cn("font-sans", geist.variable)}>
      <head>
        {/* El apretón de manos con Firebase, adelantado.
            Iniciar sesión abre conexión con dos dominios de Google, y sin esto el DNS y
            el TLS se pagan enteros en el momento de pulsar Entrar — entre 200 y 400 ms
            en los que el botón ya gira pero todavía no ha salido nada. Resueltos antes,
            el clic empieza a hablar de inmediato. */}
        <link rel="preconnect" href="https://identitytoolkit.googleapis.com" crossOrigin="" />
        <link rel="preconnect" href="https://securetoken.googleapis.com" crossOrigin="" />
        <link rel="preconnect" href="https://firestore.googleapis.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://apis.google.com" />

        {/* El aviso de "esto se puede instalar" llega una sola vez y a veces antes de que
            React exista. Este guion lo recoge, lo guarda y avisa; el boton de la cabecera
            se limita a leerlo. Sin esto, el boton no aparece hasta recargar. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "window.__instalar=null;addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__instalar=e;dispatchEvent(new Event('archicel:instalable'))});",
          }}
        />
      </head>
      <body>
        <ProveedorSesion>
          {/* El Marco vive aqui y no dentro de cada pagina: asi navegar no lo remonta.
              De eso dependen dos cosas — que el shader no se recompile al cambiar de
              seccion, y que el indicador del rail pueda animarse, porque un elemento
              recien insertado en el DOM nace en su destino y no transiciona. */}
          <ProveedorMovimiento>
            <ProveedorUI>
              <Marco>{children}</Marco>
            </ProveedorUI>
          </ProveedorMovimiento>
        </ProveedorSesion>
      </body>
    </html>
  );
}
