/**
 * El permiso de Google, y nada más.
 *
 * Aquí solo se consigue y se recuerda un token de acceso para `drive.file`. Lo que se hace
 * con él está en `archivador-drive`, y esa separación importa: este fichero es el único
 * sitio del proyecto que sabe de OAuth, así que es el único que hay que mirar el día que
 * Google cambie algo.
 *
 * ## Cero configuración, y lo que eso cuesta
 *
 * Esto se puede montar de dos maneras y hubo que elegir:
 *
 * **Con secreto de cliente**, en un servidor, se consigue un `refresh_token` y la conexión
 * es permanente de verdad: se concede una vez en la vida y nunca más. A cambio hay que
 * guardar un secreto en el entorno y mantener una ruta de servidor.
 *
 * **Sin secreto**, que es lo que hay aquí, Google no entrega refresco — no es una opción
 * que se esté evitando, es que **no existe para un cliente web**. Lo que se puede hacer es
 * recordar el token de acceso, que dura una hora.
 *
 * Se eligió lo segundo a propósito: Archicel es de una persona y no tiene que pedirle que
 * mantenga credenciales en un fichero. El precio está medido y es este:
 *
 *   · recargar, cerrar la pestaña o volver mañana **dentro de la hora** → nada que hacer;
 *   · pasada la hora, **la siguiente acción lo renueva sola**, porque subir y arrastrar
 *     nacen de un gesto y Google deja abrir su ventana desde ahí. Si ya se concedió, esa
 *     ventana se abre y se cierra sin enseñar nada.
 *
 * Lo que **no** se puede hacer es renovar al cargar la página: `requestAccessToken` abre
 * una ventana siempre, y una ventana que no nace de un clic la bloquea el navegador. Ese
 * era el fallo de antes —volver a conceder en cada recarga— y lo que lo arregla es
 * recordar el token, no insistir en renovarlo.
 *
 * ## Por qué es aceptable guardarlo
 *
 * El token vive en `localStorage`, donde puede leerlo cualquier guion de este dominio. Es
 * aceptable **por el mismo motivo por el que puede vivir en el navegador**: con
 * `drive.file` no abre nada salvo los ficheros que esta aplicación creó. Ni el resto del
 * Drive, ni el correo, ni nada más. Con `drive` completo esto sería indefendible.
 */

/** Solo esto. Ni `drive`, ni `drive.readonly`: solo lo que la propia app cree. */
export const PERMISO = 'https://www.googleapis.com/auth/drive.file';

const GUION = 'https://accounts.google.com/gsi/client';
const GUARDADO = 'archicel.drive.token.v1';

/* Se renueva antes de caducar de verdad: un token que expira a mitad de una subida de
   80 MB la tira entera. */
const MARGEN_MS = 120_000;

interface ClienteToken {
  requestAccessToken(opciones?: { prompt?: string }): void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient(opciones: {
            client_id: string;
            scope: string;
            callback: (r: { access_token?: string; expires_in?: number; error?: string; error_description?: string }) => void;
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

/* ───────────────────────── el guion de Google ───────────────────────── */

let cargando: Promise<void> | null = null;

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

/* ───────────────────────── el token recordado ───────────────────────── */

let token: string | null = null;
let caducaEn = 0;
let leido = false;

/**
 * Se lee de `localStorage` **la primera vez que hace falta**, no al cargar el módulo.
 *
 * Esta página se prerrenderiza y allí no hay `localStorage`. Leerlo arriba del todo
 * reventaría la construcción, y leerlo durante el render daría un árbol distinto en el
 * servidor y en el navegador — que es la avería de hidratación de siempre.
 */
function recordar(): void {
  if (leido || typeof window === 'undefined') return;
  leido = true;
  try {
    const crudo = localStorage.getItem(GUARDADO);
    if (!crudo) return;
    const { t, hasta } = JSON.parse(crudo) as { t?: string; hasta?: number };
    if (t && typeof hasta === 'number' && Date.now() < hasta - MARGEN_MS) {
      token = t;
      caducaEn = hasta;
    } else {
      localStorage.removeItem(GUARDADO);
    }
  } catch {
    /* almacenamiento bloqueado o contenido corrupto: se empieza de cero */
  }
}

function guardar(nuevo: string, dura: number): string {
  token = nuevo;
  caducaEn = Date.now() + dura * 1000;
  try {
    localStorage.setItem(GUARDADO, JSON.stringify({ t: nuevo, hasta: caducaEn }));
  } catch {
    /* sin almacenamiento se pierde la comodidad, no la función: seguirá valiendo en esta
       pestaña hasta que caduque */
  }
  return nuevo;
}

function olvidar(): void {
  token = null;
  caducaEn = 0;
  try {
    localStorage.removeItem(GUARDADO);
  } catch {}
}

/** Si hay un token utilizable **ahora**, sin pedirle nada a nadie ni abrir nada. */
export function hayPermiso(): boolean {
  recordar();
  return Boolean(token) && Date.now() < caducaEn - MARGEN_MS;
}

/* ───────────────────────── pedirlo ───────────────────────── */

/** Una ventana a la vez: subir cinco ficheros no puede abrir cinco. */
let pidiendo: Promise<string> | null = null;

async function pedir(): Promise<string> {
  if (pidiendo) return pidiendo;

  const id = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!id) throw new Error('Falta NEXT_PUBLIC_GOOGLE_CLIENT_ID.');

  pidiendo = (async () => {
    await cargarGuion();
    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2) throw new Error('El acceso de Google no está disponible.');

    return new Promise<string>((resolver, rechazar) => {
      /*
       * El cliente se crea **en cada petición** y no se memoriza.
       *
       * Memorizarlo hacía que la respuesta de la segunda petición resolviera la promesa de
       * la primera, porque la función de respuesta se queda atrapada en el cliente que la
       * creó. Crear uno nuevo no cuesta nada y quita de en medio esa clase entera de
       * avería.
       */
      const cliente = oauth2.initTokenClient({
        client_id: id,
        scope: PERMISO,
        callback: (r) => {
          if (r.access_token) resolver(guardar(r.access_token, r.expires_in ?? 3600));
          else rechazar(new Error(r.error_description ?? r.error ?? 'Permiso no concedido.'));
        },
        /* Se dispara al cerrar la ventana sin conceder y cuando el navegador la bloquea.
           Sin esto la promesa se queda colgada y la interfaz con el botón girando. */
        error_callback: (e) =>
          rechazar(
            new Error(
              e?.type === 'popup_closed'
                ? 'Ventana cerrada sin conceder el permiso.'
                : e?.type === 'popup_failed_to_open'
                  ? 'El navegador bloqueó la ventana de Google.'
                  : 'Permiso no concedido.',
            ),
          ),
      });

      /*
       * `prompt: ''` y no `'consent'`.
       *
       * Con el consentimiento ya dado, Google devuelve el token **sin enseñar nada**: la
       * ventana se abre y se cierra sola. Forzar `consent` obligaría a aceptar otra vez
       * cada hora, que es justo lo que se está arreglando.
       */
      cliente.requestAccessToken({ prompt: '' });
    });
  })();

  try {
    return await pidiendo;
  } finally {
    pidiendo = null;
  }
}

/**
 * Consigue un token.
 *
 * `interactivo` dice si **se viene de un gesto de la usuaria**, que es lo único que
 * permite abrir la ventana de Google. Subir y arrastrar lo son; cargar la página no.
 */
export async function conseguirToken(interactivo: boolean): Promise<string> {
  if (hayPermiso()) return token as string;
  if (!interactivo) throw new Error('Drive no está conectado.');
  return pedir();
}

/** Si Drive está listo para usarse ahora mismo, sin abrir nada. */
export function yaEstaConectado(): boolean {
  return hayClienteConfigurado() && hayPermiso();
}

/** Corta la conexión: se la revoca a Google y se olvida el token. */
export function soltarPermiso(): void {
  const t = token;
  olvidar();
  if (t) window.google?.accounts?.oauth2?.revoke(t);
}
