/**
 * El permiso de Google, y nada más.
 *
 * Aquí solo se consigue y se renueva un token de acceso para `drive.file`. Lo que se hace
 * con él está en `archivador-drive`, y esa separación importa: este fichero es el único
 * sitio del proyecto que sabe de OAuth, así que es el único que hay que mirar el día que
 * Google cambie algo.
 *
 * ## Por qué el cliente de tokens y no Firebase
 *
 * Firebase devuelve un token de Google al entrar con `signInWithPopup`, y es tentador
 * reutilizarlo. Pero **no devuelve token de refresco** y el de acceso dura una hora: a la
 * hora de estar trabajando, subir deja de funcionar y nadie sabe por qué.
 *
 * El cliente de tokens de Google Identity Services lo renueva **en silencio** mientras la
 * sesión de Google siga viva en el navegador, y no necesita secreto de cliente — así que
 * no hay nada que guardar en el servidor ni nada que se pueda filtrar de él.
 *
 * ## Por qué se pide aparte de entrar
 *
 * El permiso se pide la primera vez que hace falta —cuando se pulsa «conectar» o se sube
 * el primer apunte—, no al abrir la aplicación. Un permiso que llega en el momento en que
 * se entiende para qué es, se concede; uno que salta nada más entrar, se cierra. Y aquí la
 * cuenta es una invitación, no un muro: Archicel funciona sin conceder nada.
 */

/** Solo esto. Ni `drive`, ni `drive.readonly`: solo lo que la propia app cree. */
export const PERMISO = 'https://www.googleapis.com/auth/drive.file';

const GUION = 'https://accounts.google.com/gsi/client';

/* Se renueva antes de que caduque de verdad: un token que expira a mitad de una subida
   de 80 MB la tira entera. */
const MARGEN_MS = 120_000;

interface ClienteToken {
  requestAccessToken(opciones?: { prompt?: string }): void;
}

interface RespuestaToken {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient(opciones: {
            client_id: string;
            scope: string;
            callback: (r: RespuestaToken) => void;
            error_callback?: (e: { type?: string }) => void;
          }): ClienteToken;
          revoke(token: string, hecho?: () => void): void;
        };
      };
    };
  }
}

export function hayClienteConfigurado(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
}

let cargando: Promise<void> | null = null;

/** Trae el guion de Google una sola vez por pestaña. */
function cargarGuion(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('sin navegador'));
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  cargando ??= new Promise<void>((resolver, rechazar) => {
    const ya = document.querySelector<HTMLScriptElement>(`script[src="${GUION}"]`);
    const nodo = ya ?? document.createElement('script');
    nodo.addEventListener('load', () => resolver());
    nodo.addEventListener('error', () => {
      cargando = null;
      rechazar(new Error('No se pudo cargar el acceso de Google.'));
    });
    if (!ya) {
      nodo.src = GUION;
      nodo.async = true;
      document.head.appendChild(nodo);
    }
  });
  return cargando;
}

let cliente: ClienteToken | null = null;
let token: string | null = null;
let caducaEn = 0;
/** Una petición a la vez: dos subidas simultáneas no pueden abrir dos ventanas. */
let enCurso: Promise<string> | null = null;

/** Si ya se concedió en esta pestaña y el token sigue sirviendo. */
export function hayPermiso(): boolean {
  return Boolean(token) && Date.now() < caducaEn - MARGEN_MS;
}

/**
 * Consigue un token.
 *
 * `interactivo` decide si puede abrir la ventana de Google. En falso solo devuelve algo si
 * ya se puede renovar sin molestar — que es lo que hay que usar al arrancar, para no
 * plantarle una ventana en la cara a quien solo ha abierto una asignatura.
 */
export async function conseguirToken(interactivo: boolean): Promise<string> {
  if (hayPermiso()) return token as string;

  const id = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!id) throw new Error('Falta NEXT_PUBLIC_GOOGLE_CLIENT_ID.');

  if (enCurso) return enCurso;

  enCurso = (async () => {
    await cargarGuion();
    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2) throw new Error('El acceso de Google no está disponible.');

    return new Promise<string>((resolver, rechazar) => {
      cliente ??= oauth2.initTokenClient({
        client_id: id,
        scope: PERMISO,
        callback: (r) => {
          if (r.access_token) {
            token = r.access_token;
            caducaEn = Date.now() + (r.expires_in ?? 3600) * 1000;
            resolver(r.access_token);
          } else {
            rechazar(new Error(r.error_description ?? r.error ?? 'Permiso no concedido.'));
          }
        },
        /* Se dispara cuando se cierra la ventana sin conceder. Sin esto la promesa se
           queda colgada para siempre y la interfaz con el botón girando. */
        error_callback: (e) => rechazar(new Error(e?.type === 'popup_closed' ? 'Ventana cerrada.' : 'Permiso no concedido.')),
      });

      /*
       * `prompt: ''` pide en silencio: si ya se concedió alguna vez, devuelve un token sin
       * enseñar nada. Solo cuando la usuaria ha pedido conectar explícitamente se fuerza
       * el consentimiento.
       */
      cliente.requestAccessToken({ prompt: interactivo ? 'consent' : '' });
    });
  })();

  try {
    return await enCurso;
  } finally {
    enCurso = null;
  }
}

/** Olvida el permiso en esta pestaña y se lo dice a Google. */
export function soltarPermiso(): void {
  const t = token;
  token = null;
  caducaEn = 0;
  if (t) window.google?.accounts?.oauth2?.revoke(t);
}
