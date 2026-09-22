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

/**
 * La petición en vuelo, **y si era de las que pueden abrir ventana**.
 *
 * Guardar solo la promesa era un fallo con consecuencia visible: el botón «Conectar
 * Drive» se quedaba en «Conectando…» para siempre.
 *
 * Lo que pasaba. Al abrir una asignatura se lanza un intento silencioso. Si ese intento
 * no contesta —y no contesta cuando el navegador bloquea su ventana, que es lo normal
 * para algo que no ha pedido nadie—, la promesa se queda pendiente. Al pulsar el botón,
 * la protección de «una petición a la vez» devolvía **esa misma promesa muerta** en lugar
 * de abrir la ventana de verdad. Nunca se pedía el permiso y nunca llegaba la respuesta.
 *
 * Así que una petición interactiva **nunca reutiliza una silenciosa**: la silenciosa se
 * abandona y se pide de nuevo. Dos interactivas sí se comparten, que es de lo que iba la
 * protección — que dos subidas a la vez no abran dos ventanas.
 */
let enCurso: { promesa: Promise<string>; interactivo: boolean } | null = null;

/** Quien espera la respuesta de Google ahora mismo. Solo puede haber una. */
interface Pendiente {
  resolver: (token: string) => void;
  rechazar: (error: Error) => void;
  cerrar: () => void;
}
let pendiente: Pendiente | null = null;

/** Lo que se espera a un intento silencioso antes de darlo por perdido. */
const ESPERA_SILENCIOSA = 8_000;

/** Si ya se concedió en esta pestaña y el token sigue sirviendo. */
export function hayPermiso(): boolean {
  return Boolean(token) && Date.now() < caducaEn - MARGEN_MS;
}

/* ── la memoria de que esto ya se concedió una vez ──
   No guarda ningún token: solo una marca. Sirve para no intentar renovar en silencio a
   quien nunca ha concedido nada, porque ese intento abre una ventana que el navegador
   bloquea por no venir de un clic. */
const MARCA = 'archicel.drive.concedido';

export function seConcedioAntes(): boolean {
  try {
    return localStorage.getItem(MARCA) === '1';
  } catch {
    return false;
  }
}

function recordarConcedido(): void {
  try {
    localStorage.setItem(MARCA, '1');
  } catch {
    /* sin almacenamiento se pierde la comodidad, no la función */
  }
}

export function olvidarConcedido(): void {
  try {
    localStorage.removeItem(MARCA);
  } catch {}
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

  /* Solo se reutiliza lo que sirve: una interactiva vale para todo, una silenciosa solo
     para otra silenciosa. */
  if (enCurso && (enCurso.interactivo || !interactivo)) return enCurso.promesa;

  const promesa = (async () => {
    await cargarGuion();
    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2) throw new Error('El acceso de Google no está disponible.');

    return new Promise<string>((resolver, rechazar) => {
      /* Un reloj por si Google no contesta nunca. Sin esto, un intento perdido deja la
         promesa colgada y con ella cualquier cosa que la esté esperando. */
      const reloj = interactivo
        ? null
        : setTimeout(() => {
            if (pendiente === yo) pendiente = null;
            rechazar(new Error('Sin respuesta de Google.'));
          }, ESPERA_SILENCIOSA);

      const yo: Pendiente = {
        resolver,
        rechazar,
        cerrar: () => {
          if (reloj) clearTimeout(reloj);
        },
      };

      /*
       * El cliente se crea **una sola vez** y su respuesta va a quien esté esperando en
       * ese momento, no a quien lo creó.
       *
       * Escrito de la forma evidente —crear el cliente con `callback: resolver` la primera
       * vez y reutilizarlo— la respuesta de la segunda petición resolvía la promesa de la
       * primera, que ya no la esperaba nadie. La segunda no se enteraba nunca. Era la
       * misma avería que el botón colgado, una capa más abajo, y no se ve leyendo porque
       * parece una memorización inofensiva.
       */
      cliente ??= oauth2.initTokenClient({
        client_id: id,
        scope: PERMISO,
        callback: (r) => {
          const quien = pendiente;
          pendiente = null;
          quien?.cerrar();
          if (r.access_token) {
            token = r.access_token;
            caducaEn = Date.now() + (r.expires_in ?? 3600) * 1000;
            recordarConcedido();
            quien?.resolver(r.access_token);
          } else {
            quien?.rechazar(new Error(r.error_description ?? r.error ?? 'Permiso no concedido.'));
          }
        },
        /* Se dispara al cerrar la ventana sin conceder, y también cuando el navegador la
           bloquea. Sin esto la promesa se queda colgada para siempre y la interfaz con el
           botón girando — que es exactamente lo que pasaba. */
        error_callback: (e) => {
          const quien = pendiente;
          pendiente = null;
          quien?.cerrar();
          quien?.rechazar(
            new Error(
              e?.type === 'popup_closed'
                ? 'Ventana cerrada sin conceder el permiso.'
                : e?.type === 'popup_failed_to_open'
                  ? 'El navegador bloqueó la ventana de Google.'
                  : 'Permiso no concedido.',
            ),
          );
        },
      });

      /* Si había otra esperando, se le dice que ha perdido su turno en vez de dejarla
         colgada: solo puede haber una respuesta en vuelo. */
      pendiente?.cerrar();
      pendiente?.rechazar(new Error('Otra petición tomó el relevo.'));
      pendiente = yo;

      /*
       * `prompt: ''` pide en silencio: si ya se concedió alguna vez, devuelve un token sin
       * enseñar nada. Solo cuando la usuaria ha pedido conectar explícitamente se fuerza
       * el consentimiento.
       */
      cliente.requestAccessToken({ prompt: interactivo ? 'consent' : '' });
    });
  })();

  enCurso = { promesa, interactivo };
  try {
    return await promesa;
  } finally {
    /* Solo se limpia si sigue siendo la nuestra: una interactiva puede haber sustituido
       a esta silenciosa mientras tanto, y borrarla dejaría a quien la espera sin nadie
       que la resuelva. */
    if (enCurso?.promesa === promesa) enCurso = null;
  }
}

/** Olvida el permiso en esta pestaña y se lo dice a Google. */
export function soltarPermiso(): void {
  const t = token;
  token = null;
  caducaEn = 0;
  olvidarConcedido();
  if (t) window.google?.accounts?.oauth2?.revoke(t);
}
