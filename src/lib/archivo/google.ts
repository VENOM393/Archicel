/**
 * El permiso de Google, y nada más.
 *
 * Aquí solo se consigue y se recuerda un token de acceso para `drive.file`. Lo que se hace
 * con él está en `archivador-drive`, y esa separación importa: este fichero es el único
 * sitio del proyecto que sabe de OAuth, así que es el único que hay que mirar el día que
 * Google cambie algo.
 *
 * ## Permanente, y lo que hizo falta para serlo
 *
 * Se concede **una vez** y no se vuelve a pedir: ni al recargar, ni al desplegar, ni dentro
 * de seis meses. Lo que lo consigue es el **token de refresco**, y Google solo lo entrega a
 * quien presente el secreto del cliente — por eso existe `/api/drive/token` y por eso el
 * canje no puede ocurrir aquí.
 *
 * Antes no había secreto y la consecuencia era concreta: el token de acceso dura una hora,
 * así que recargar pasada esa hora devolvía la pantalla a «Sin conectar». Con la pestaña
 * abierta se renovaba sola —subir nace de un clic y desde ahí Google deja abrir su
 * ventana—, pero **al cargar una página no hay clic del que colgarse**, y una ventana que
 * no nace de un gesto la bloquea el navegador. Esa era la pared.
 *
 * Ahora la renovación es una llamada a nuestro propio servidor: no abre nada, no necesita
 * gesto, y funciona igual al cargar que a mitad de una subida.
 *
 * ## Dónde está cada token
 *
 *   · **el de refresco**, en una cookie `HttpOnly` que este fichero no puede leer. No sale
 *     nunca del servidor;
 *   · **el de acceso**, solo en memoria y solo durante su hora.
 *
 * Es más seguro que lo que había, donde el de acceso vivía en `localStorage` y lo leía
 * cualquier guion del dominio. Lo único que queda en `localStorage` es una **marca** que
 * dice que esta persona quiere Drive: no es una credencial y no abre nada.
 *
 * La conexión sigue siendo **por navegador**, porque una cookie lo es. Es el modelo que
 * Archicel ya tenía: Celeste conecta el suyo, Cristian el suyo.
 */

/** Solo esto. Ni `drive`, ni `drive.readonly`: solo lo que la propia app cree. */
export const PERMISO = 'https://www.googleapis.com/auth/drive.file';

const GUION = 'https://accounts.google.com/gsi/client';
const RUTA = '/api/drive/token';
/**
 * La marca de que esta persona **quiere** Drive. No es una credencial y no abre nada.
 *
 * Hace falta porque el token de refresco vive en una cookie `HttpOnly` que este fichero no
 * puede leer: sin la marca, al cargar la página no habría forma de distinguir «nunca ha
 * conectado» de «conectada, pero todavía no he pedido el token de esta sesión», y la
 * pantalla enseñaría la invitación a conectar a alguien que ya lo está.
 */
const USADO = 'archicel.drive.usado.v1';
/* La clave donde vivía el token de acceso. Ya no se escribe: se borra al arrancar, porque
   un token suelto en `localStorage` es exactamente lo que este cambio quita de en medio. */
const VIEJO = 'archicel.drive.token.v1';

/* Se renueva antes de caducar de verdad: un token que expira a mitad de una subida de
   80 MB la tira entera. */
const MARGEN_MS = 120_000;

interface ClienteCodigo {
  requestCode(): void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          /**
           * El cliente de **código**, no el de token.
           *
           * `initTokenClient` devuelve un token de acceso y nada más: es el flujo implícito
           * y por diseño no da refresco. El de código devuelve un `code` de un solo uso que
           * el servidor cambia por los dos tokens. Es la diferencia entre una conexión de
           * una hora y una permanente.
           */
          initCodeClient(opciones: {
            client_id: string;
            scope: string;
            ux_mode: 'popup' | 'redirect';
            callback: (r: { code?: string; scope?: string; error?: string; error_description?: string }) => void;
            error_callback?: (e: { type?: string }) => void;
          }): ClienteCodigo;
          revoke(token: string, hecho?: (r: { successful?: boolean; error?: string }) => void): void;
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

/* Conectar y desconectar se avisan con un evento del navegador, no con estado de React:
   este fichero no sabe de componentes, y así cualquier pantalla —los ajustes, la página
   de una asignatura— puede enterarse sin que la otra tenga que estar montada. */
const CAMBIO = 'archicel:drive';
const avisarCambio = () => window.dispatchEvent(new Event(CAMBIO));

/**
 * Avisa cada vez que Drive se conecta o se desconecta, en esta pestaña **o en otra**.
 *
 * Lo segundo importa: si se desconecta desde una ventana, la otra conservaba el token en
 * memoria y seguía subiendo con un permiso que ya no existe.
 */
export function alCambiarDrive(fn: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const ajeno = (e: StorageEvent) => {
    if (e.key !== USADO) return;
    /* Lo que diga el almacenamiento manda: se vuelve a leer en la siguiente consulta. */
    token = null;
    caducaEn = 0;
    leido = false;
    fn();
  };
  window.addEventListener(CAMBIO, fn);
  window.addEventListener('storage', ajeno);
  return () => {
    window.removeEventListener(CAMBIO, fn);
    window.removeEventListener('storage', ajeno);
  };
}

/**
 * Limpia el token que las versiones anteriores dejaban en `localStorage`.
 *
 * Se hace **la primera vez que hace falta** y no al cargar el módulo: esta página se
 * prerrenderiza y allí no hay `localStorage`. Leerlo arriba del todo reventaría la
 * construcción.
 */
function recordar(): void {
  if (leido || typeof window === 'undefined') return;
  leido = true;
  try {
    localStorage.removeItem(VIEJO);
  } catch {
    /* almacenamiento bloqueado: no hay nada que limpiar y nada que perder */
  }
}

function guardar(nuevo: string, dura: number): string {
  token = nuevo;
  caducaEn = Date.now() + dura * 1000;
  try {
    localStorage.setItem(USADO, '1');
  } catch {
    /* sin almacenamiento se pierde la comodidad, no la función: seguirá valiendo en esta
       pestaña hasta que caduque */
  }
  avisarCambio();
  return nuevo;
}

function olvidar(): void {
  token = null;
  caducaEn = 0;
  try {
    localStorage.removeItem(USADO);
    localStorage.removeItem(VIEJO);
  } catch {}
  avisarCambio();
}

/**
 * Drive ha rechazado este token: se tira para que la siguiente petición pida otro.
 *
 * Sin esto, un token revocado o caducado antes de hora seguiría pareciendo válido hasta su
 * fecha, y «Reconectar y reintentar» devolvería el mismo token muerto sin abrir nada. Solo
 * se tira si sigue siendo el recordado: si otra petición ya consiguió uno nuevo, ese vale.
 *
 * **La marca de uso se queda**, porque quererlo no ha cambiado — y ahora además importa
 * más: con la marca puesta, la siguiente petición renueva contra el servidor sin abrir
 * ninguna ventana. Tirar un token de acceso dejó de ser un problema.
 */
export function caducarToken(rechazado: string): void {
  if (token !== rechazado) return;
  token = null;
  caducaEn = 0;
}

/**
 * Si esta persona ya ha conectado Drive alguna vez en este navegador.
 *
 * Distinto de `hayPermiso`: eso es «puedo usarlo ahora», esto es «lo quiere». Pasada la
 * hora lo primero es falso y lo segundo sigue siendo verdad, y esa diferencia es la que
 * evita que una subida se vaya al disco sin decir nada.
 */
export function seHaUsadoDrive(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(USADO) === '1';
  } catch {
    return false;
  }
}

/** Si hay un token utilizable **ahora**, sin pedirle nada a nadie ni abrir nada. */
export function hayPermiso(): boolean {
  recordar();
  return Boolean(token) && Date.now() < caducaEn - MARGEN_MS;
}

/* ───────────────────────── el servidor ───────────────────────── */

interface DelServidor {
  access_token?: string;
  expires_in?: number;
  error?: string;
  dijo?: string | null;
}

async function alServidor(cuerpo: { accion: string; code?: string }): Promise<DelServidor> {
  const r = await fetch(RUTA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
    /* La cookie del refresco es del mismo origen, pero decirlo explícitamente evita que
       un cambio de configuración la deje fuera sin que nadie se entere. */
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const j = (await r.json().catch(() => ({}))) as DelServidor;
  if (!r.ok) throw new Error(j.dijo || j.error || 'El servidor no pudo renovar el permiso.');
  return j;
}

/* ───────────────────────── renovar, sin abrir nada ───────────────────────── */

/** Una renovación a la vez: cinco subidas no pueden pedir cinco tokens. */
let renovando: Promise<string> | null = null;

/**
 * Pide un token nuevo con el refresco que guarda el servidor.
 *
 * Esto es lo que hace que la conexión sea permanente, y lo que lo distingue de lo de antes
 * es que **no abre ninguna ventana**: es una petición a nuestro propio dominio, así que da
 * igual que venga de un clic o de cargar la página.
 */
async function renovar(): Promise<string> {
  renovando ??= (async () => {
    const r = await alServidor({ accion: 'renovar' });
    if (!r.access_token) throw new Error('El servidor no devolvió ningún permiso.');
    return guardar(r.access_token, r.expires_in ?? 3600);
  })();
  try {
    return await renovando;
  } finally {
    renovando = null;
  }
}

/**
 * Intenta dejar Drive listo al abrir la aplicación, sin molestar a nadie.
 *
 * Si no hay cookie —nunca conectó, o la revocó— falla en silencio y la pantalla ofrece
 * conectar, que es lo correcto. No se trata de insistir: se trata de que quien ya dijo que
 * sí no tenga que repetirlo.
 */
export async function renovarEnSilencio(): Promise<boolean> {
  if (!hayClienteConfigurado() || typeof window === 'undefined') return false;
  if (hayPermiso()) return true;
  /* Sin la marca no ha conectado nunca en este navegador: preguntarle al servidor sería
     una petición garantizada a fallar en cada carga de página. */
  if (!seHaUsadoDrive()) return false;
  try {
    await renovar();
    return true;
  } catch {
    /* El refresco ya no vale —revocado, caducado por medio año sin usarlo, contraseña
       cambiada—. El servidor ya ha tirado la cookie; aquí se tira la marca para que la
       pantalla diga «Sin conectar» en vez de prometer algo que no puede cumplir. */
    olvidar();
    return false;
  }
}

/* ───────────────────────── conceder ───────────────────────── */

/** Una ventana a la vez: subir cinco ficheros no puede abrir cinco. */
let pidiendo: Promise<string> | null = null;

/**
 * Abre la ventana de Google y canjea el código que devuelve.
 *
 * Solo desde un gesto: una ventana que no nace de un clic la bloquea el navegador.
 */
async function pedir(): Promise<string> {
  if (pidiendo) return pidiendo;

  const id = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!id) throw new Error('Falta NEXT_PUBLIC_GOOGLE_CLIENT_ID.');

  pidiendo = (async () => {
    await cargarGuion();
    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2) throw new Error('El acceso de Google no está disponible.');

    const codigo = await new Promise<string>((resolver, rechazar) => {
      /*
       * El cliente se crea **en cada petición** y no se memoriza.
       *
       * Memorizarlo hacía que la respuesta de la segunda petición resolviera la promesa de
       * la primera, porque la función de respuesta se queda atrapada en el cliente que la
       * creó. Crear uno nuevo no cuesta nada y quita de en medio esa clase entera de
       * avería.
       */
      const cliente = oauth2.initCodeClient({
        client_id: id,
        scope: PERMISO,
        ux_mode: 'popup',
        callback: (r) => {
          /*
           * Un código **sin** el permiso de Drive no vale, aunque Google lo entregue.
           *
           * La ventana de Google deja desmarcar la casilla de Drive y aun así devuelve un
           * código; canjearlo haría que cada llamada contestara 403
           * «insufficientPermissions» y que «Reconectar» devolviera lo mismo sin volver a
           * preguntar. Se rechaza aquí, con el porqué, y la siguiente vez Google vuelve a
           * enseñar la casilla. El `scope` que devuelve es la lista concedida.
           */
          if (r.code && r.scope !== undefined && !r.scope.split(' ').includes(PERMISO)) {
            rechazar(new Error('No se concedió el permiso de Drive: al conectar, deja marcada su casilla.'));
            return;
          }
          if (r.code) resolver(r.code);
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

      cliente.requestCode();
    });

    const r = await alServidor({ accion: 'canjear', code: codigo });
    if (!r.access_token) throw new Error('El servidor no devolvió ningún permiso.');
    return guardar(r.access_token, r.expires_in ?? 3600);
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
 * Tres escalones, y el del medio es el que cambió todo: lo que ya se tiene, lo que el
 * servidor puede renovar **sin abrir nada**, y solo entonces la ventana de Google.
 *
 * `interactivo` dice si se viene de un gesto de la usuaria, que es lo único que permite
 * abrir esa ventana. Subir y arrastrar lo son; cargar la página no — pero cargar la página
 * ya no la necesita.
 */
export async function conseguirToken(interactivo: boolean): Promise<string> {
  if (hayPermiso()) return token as string;

  if (seHaUsadoDrive()) {
    try {
      return await renovar();
    } catch (e) {
      /* El refresco no vale. Si venimos de un gesto se puede volver a conceder aquí
         mismo; si no, se dice y la pantalla ofrecerá conectar. */
      olvidar();
      if (!interactivo) throw e;
    }
  }

  if (!interactivo) throw new Error('Drive no está conectado.');
  return pedir();
}

/** Si Drive está listo para usarse ahora mismo, sin abrir nada. */
export function yaEstaConectado(): boolean {
  return hayClienteConfigurado() && hayPermiso();
}

/**
 * Corta la conexión: se olvida todo **y** se le pide a Google que retire el permiso.
 *
 * Olvidar va primero y no depende de nada. Aunque Google no conteste, desde ese momento
 * Archicel no tiene con qué entrar en el Drive de nadie, que es lo que se ha pedido.
 *
 * Lo que se revoca es el **token de refresco**, no el de acceso, y eso importa: revocar el
 * refresco retira la concesión entera —también los tokens de acceso que sigan vivos—,
 * mientras que revocar uno de acceso solo mata esa hora. Antes se revocaba el de acceso
 * porque era lo único que había, y pasada la hora no quedaba nada que revocar: la pantalla
 * tenía que decir que no podía confirmarlo. Ahora sí puede, siempre.
 *
 * Como el refresco vive en una cookie que este fichero no puede leer, quien revoca es la
 * ruta de servidor. Devuelve si Google **confirmó** la revocación; puede no hacerlo si no
 * hay red, y entonces el permiso sigue concedido en la cuenta de Google y se retira desde
 * allí.
 */
export async function soltarPermiso(): Promise<boolean> {
  olvidar();
  try {
    const r = await alServidor({ accion: 'desconectar' });
    return (r as { confirmado?: boolean }).confirmado === true;
  } catch {
    /* Sin red no se puede confirmar. Desde este navegador ya no se entra igualmente: la
       cookie se va con la respuesta, y si la respuesta no llega el token de memoria ya
       está tirado y el de refresco caduca solo. */
    return false;
  }
}
