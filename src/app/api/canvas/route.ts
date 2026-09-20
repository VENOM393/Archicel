import { NextResponse, type NextRequest } from 'next/server';

import { olvidar, resumen } from '@/lib/canvas/servicio';

/**
 * La única puerta entre Archicel y Canvas.
 *
 * Es la primera pieza del proyecto que corre en el servidor, y existe por una razón
 * concreta y comprobada: **Canvas no permite llamadas desde el navegador**. Una petición
 * de prevuelo contra `canvas.ucam.edu` devuelve 404 sin ninguna cabecera CORS. No es un
 * descuido de la UCAM — Canvas no publica CORS a propósito, porque su credencial es un
 * token portador con acceso total a la cuenta. Si el navegador pudiera llamar, el token
 * tendría que estar en el navegador.
 *
 * Así que el token vive aquí y no sale. Lo que cruza al cliente es lo ya traducido al
 * modelo de Archicel: títulos, fechas y asignaturas. Ni notas, ni mensajes, ni el token.
 *
 * `GET  /api/canvas?desde=YYYY-MM-DD&hasta=YYYY-MM-DD` — lo que vence en ese rango.
 * `POST /api/canvas`                                   — tira la caché y vuelve a traer.
 */

/* Nada de prerenderizado: esto llama a un servicio externo en cada petición. */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** `YYYY-MM-DD` y nada más: lo que llega por la URL no se le pasa a nadie sin mirarlo. */
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function rango(req: NextRequest): { desde: string; hasta: string } {
  const p = req.nextUrl.searchParams;
  const hoy = new Date();
  const dia = (d: Date) => d.toISOString().slice(0, 10);

  const desde = p.get('desde');
  const hasta = p.get('hasta');

  /* Por defecto, la ventana que de verdad se mira: desde hace una semana —para que una
     entrega recién vencida siga a la vista— hasta dentro de dos meses. */
  const pordefectoDesde = new Date(hoy);
  pordefectoDesde.setDate(pordefectoDesde.getDate() - 7);
  const pordefectoHasta = new Date(hoy);
  pordefectoHasta.setDate(pordefectoHasta.getDate() + 60);

  return {
    desde: desde && FECHA.test(desde) ? desde : dia(pordefectoDesde),
    hasta: hasta && FECHA.test(hasta) ? hasta : dia(pordefectoHasta),
  };
}

export async function GET(req: NextRequest) {
  const { desde, hasta } = rango(req);
  const datos = await resumen(desde, hasta, req.signal);

  /* Un fallo de Canvas se cuenta con un código propio, no con un 500: para la aplicación
     no es un error del servidor, es un estado que sabe pintar. El 200 con `estado` dentro
     evita además que el navegador y cualquier proxy intermedio traten esto como una caída. */
  return NextResponse.json(datos, {
    status: 200,
    headers: {
      /* La caché de verdad está en el servicio, con su caducidad. Aquí se prohíbe que
         nadie más guarde una copia: lleva datos personales. */
      'Cache-Control': 'private, no-store',
    },
  });
}

export async function POST(req: NextRequest) {
  olvidar();
  const { desde, hasta } = rango(req);
  const datos = await resumen(desde, hasta, req.signal);
  return NextResponse.json(datos, { status: 200, headers: { 'Cache-Control': 'private, no-store' } });
}
