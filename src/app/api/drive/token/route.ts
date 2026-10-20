import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

/**
 * El intercambio con Google, que es la única parte que no puede ocurrir en el navegador.
 *
 * ## Por qué existe esta ruta
 *
 * Google solo entrega un **token de refresco** —el que hace que la conexión sea permanente
 * de verdad— si quien pide el canje presenta el secreto del cliente. Y un secreto en el
 * navegador no es un secreto. Esa es toda la razón de que esto sea servidor.
 *
 * Antes no existía y el precio era concreto: el token de acceso dura una hora, así que
 * recargar pasada esa hora devolvía la pantalla a «Sin conectar» y había que volver a
 * pulsar Conectar Drive. Con la pestaña abierta se renovaba sola —subir nace de un clic y
 * desde ahí Google deja abrir su ventana—, pero al recargar no hay clic del que colgarse.
 *
 * ## Dónde vive el token de refresco
 *
 * En una **cookie `HttpOnly`**, que el JavaScript de la página no puede leer. Es más
 * seguro que lo que había: el token de acceso vivía en `localStorage`, donde lo leía
 * cualquier guion del dominio. Ahora el de acceso solo existe en memoria durante su hora y
 * el de refresco no sale nunca del servidor.
 *
 * No se guarda en ninguna base de datos a propósito: sin base, no hay nada que proteger
 * más allá de la cookie, y la conexión sigue siendo **por navegador**, que es el modelo que
 * Archicel ya tenía — Celeste conecta el suyo, Cristian el suyo.
 *
 * ## Qué no hace
 *
 * No toca los ficheros. La subida sigue yendo del navegador a Google directamente, porque
 * Vercel corta el cuerpo de una petición en 4,5 MB y un PDF escaneado se pasa de ahí sin
 * esfuerzo. Esta ruta solo mueve credenciales.
 */

/** Dinámica siempre: lee y escribe cookies, así que no se puede prerrenderizar. */
export const dynamic = 'force-dynamic';

const COOKIE = 'archicel_drive_rt';
const CANJE = 'https://oauth2.googleapis.com/token';
const REVOCAR = 'https://oauth2.googleapis.com/revoke';

/**
 * Medio año.
 *
 * Google caduca un token de refresco a los seis meses sin usarlo. Darle a la cookie la
 * misma vida evita el caso peor: una cookie viva apuntando a un refresco muerto, que se
 * lee como «estoy conectada» hasta que falla la primera subida.
 */
const VIDA = 60 * 60 * 24 * 180;

/**
 * El `redirect_uri` del flujo de ventana emergente es literalmente esta palabra.
 *
 * No es una dirección: con `ux_mode: 'popup'` Google devuelve el código por `postMessage`
 * a la página que lo pidió, y el canje tiene que decir eso mismo o contesta
 * `redirect_uri_mismatch`. Es la parte menos adivinable de todo esto.
 */
const DESTINO = 'postmessage';

/**
 * Las dos piezas, y **cuál falta** si falta alguna.
 *
 * Decir «falta GOOGLE_CLIENT_SECRET» cuando lo que falta es el identificador manda a
 * buscar al sitio equivocado, y las dos se configuran en pantallas distintas de dos
 * consolas distintas. Un mensaje que nombra la variable correcta ahorra media tarde.
 */
function credenciales(): { id: string; secreto: string } | { faltan: string[] } {
  const id = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';
  const secreto = process.env.GOOGLE_CLIENT_SECRET ?? '';
  const faltan = [
    ...(id ? [] : ['NEXT_PUBLIC_GOOGLE_CLIENT_ID']),
    ...(secreto ? [] : ['GOOGLE_CLIENT_SECRET']),
  ];
  return faltan.length ? { faltan } : { id, secreto };
}

/** Lo que Google contesta. Solo se lee lo que se usa. */
interface Respuesta {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

async function aGoogle(cuerpo: Record<string, string>): Promise<Respuesta> {
  const r = await fetch(CANJE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(cuerpo).toString(),
    cache: 'no-store',
  });
  return (await r.json()) as Respuesta;
}

/**
 * El motivo, tal cual lo dijo Google.
 *
 * Un «no se pudo conectar» genérico ya escondió una vez durante tres rondas que la API de
 * Drive estaba apagada en el proyecto. Lo que no se devuelve nunca es el secreto ni el
 * token de refresco: `error` y `error_description` de Google no los llevan.
 */
function fallo(r: Respuesta, estado = 400) {
  return NextResponse.json(
    { error: r.error ?? 'fallo', dijo: r.error_description ?? null },
    { status: estado },
  );
}

export async function POST(pet: NextRequest) {
  const cred = credenciales();
  if ('faltan' in cred) {
    return NextResponse.json(
      {
        error: 'sin-configurar',
        faltan: cred.faltan,
        dijo: `${cred.faltan.length === 1 ? 'Falta' : 'Faltan'} ${cred.faltan.join(' y ')} en el entorno del servidor. Al añadirlas en Vercel hay que volver a desplegar: un despliegue que ya existe no las recoge solo.`,
      },
      { status: 501 },
    );
  }

  let cuerpo: { accion?: string; code?: string };
  try {
    cuerpo = (await pet.json()) as { accion?: string; code?: string };
  } catch {
    return NextResponse.json({ error: 'cuerpo-ilegible' }, { status: 400 });
  }

  /* ── conceder: el código de la ventana se cambia por los dos tokens ── */
  if (cuerpo.accion === 'canjear') {
    if (!cuerpo.code) return NextResponse.json({ error: 'sin-codigo' }, { status: 400 });

    const r = await aGoogle({
      code: cuerpo.code,
      client_id: cred.id,
      client_secret: cred.secreto,
      redirect_uri: DESTINO,
      grant_type: 'authorization_code',
    });
    if (!r.access_token) return fallo(r);

    /*
     * Puede no venir refresco, y entonces **no es permanente**.
     *
     * Google no repite el token de refresco si esta cuenta ya le dio acceso sin conexión a
     * este cliente y sigue vivo. Si ya había cookie, eso es normal y no pasa nada: la de
     * antes sigue sirviendo y borrarla convertiría una reconexión en una desconexión.
     *
     * Si **no** había cookie, es el caso malo: la sesión de esta hora funcionaría y al
     * recargar volvería a pedir permiso, que es exactamente lo que se vino a arreglar. Se
     * dice en vez de dejarlo pasar, porque un fallo silencioso aquí se descubre dentro de
     * una hora y parece otra cosa. La salida es retirar el acceso de Archicel en la cuenta
     * de Google y volver a conectar: entonces Google sí lo entrega.
     */
    const habia = Boolean(pet.cookies.get(COOKIE)?.value);
    if (!r.refresh_token && !habia) {
      return NextResponse.json(
        {
          error: 'sin-refresco',
          dijo:
            'Google no entregó un permiso permanente porque esta cuenta ya le había dado acceso a Archicel. ' +
            'Retíralo en Cuenta de Google → Datos y privacidad → Conexiones con apps y servicios, y vuelve a conectar.',
        },
        { status: 409 },
      );
    }

    const res = NextResponse.json({ access_token: r.access_token, expires_in: r.expires_in ?? 3600 });
    if (r.refresh_token) {
      res.cookies.set(COOKIE, r.refresh_token, {
        httpOnly: true,
        /* En desarrollo se sirve por http y una cookie `secure` no se guardaría. */
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: VIDA,
      });
    }
    return res;
  }

  /* ── renovar: lo que hace que recargar no pida nada ── */
  if (cuerpo.accion === 'renovar') {
    const refresco = pet.cookies.get(COOKIE)?.value;
    if (!refresco) return NextResponse.json({ error: 'sin-refresco' }, { status: 401 });

    const r = await aGoogle({
      refresh_token: refresco,
      client_id: cred.id,
      client_secret: cred.secreto,
      grant_type: 'refresh_token',
    });
    if (!r.access_token) {
      /*
       * El refresco ya no vale: revocado desde la cuenta de Google, caducado por seis
       * meses sin usarlo, o la contraseña cambió. Se tira la cookie, porque dejarla hace
       * que la pantalla diga «conectada» y falle en cada acción sin explicar por qué.
       */
      const res = fallo(r, 401);
      res.cookies.delete(COOKIE);
      return res;
    }
    return NextResponse.json({ access_token: r.access_token, expires_in: r.expires_in ?? 3600 });
  }

  /* ── desconectar ── */
  if (cuerpo.accion === 'desconectar') {
    const refresco = pet.cookies.get(COOKIE)?.value;
    let confirmado = false;
    if (refresco) {
      try {
        /* Revocar el refresco retira **toda** la concesión, también los tokens de acceso
           que sigan vivos. Por eso se revoca este y no el de acceso. */
        const r = await fetch(REVOCAR, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: refresco }).toString(),
          cache: 'no-store',
        });
        confirmado = r.ok;
      } catch {
        /* Sin red no se puede confirmar. La cookie se va igual: desde este navegador ya
           no se entra, que es lo que se ha pedido. */
      }
    }
    const res = NextResponse.json({ confirmado });
    res.cookies.delete(COOKIE);
    return res;
  }

  return NextResponse.json({ error: 'accion-desconocida' }, { status: 400 });
}
