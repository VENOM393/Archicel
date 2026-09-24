/**
 * El archivador contra Google Drive.
 *
 * Los bytes van **del navegador a Google directamente**. Archicel no los ve pasar, y no
 * es una preferencia estética: Vercel corta el cuerpo de una petición en 4,5 MB y una
 * lámina escaneada se pasa de ahí sin esfuerzo, así que pasar los apuntes por `/api`
 * significa que el día que suba algo grande se rompe — y se rompe con un error que no
 * dice por qué.
 *
 * Que el token viva en el navegador es aceptable **precisamente** por `drive.file`:
 * aunque alguien lo robase, no abre nada más que los ficheros que esta aplicación creó.
 * Con `drive` completo esta decisión sería indefendible.
 *
 * ## La carpeta
 *
 * ```
 * Archicel/
 *   Asignaturas/
 *     Geometría Descriptiva I/
 * ```
 *
 * Con el **nombre largo** de la asignatura y no con su clave interna: quien abra esto
 * desde Drive tiene que entender qué está mirando sin saber que existe un `curso.ts`.
 *
 * Y con `drive.file` se pueden buscar: la búsqueda solo devuelve lo que esta aplicación
 * creó, así que encontrar «la carpeta Archicel» encuentra la nuestra y no una tuya que se
 * llame igual. Por eso no hace falta guardar identificadores en ningún sitio — se buscan
 * una vez por pestaña y se recuerdan en memoria. Si alguien la borra desde Drive, la
 * siguiente subida la crea otra vez en lugar de fallar contra un identificador muerto.
 */

import { ASIGNATURAS } from '@/lib/data';
import { FalloDeArchivo, type Archivador, type Destino, type Remoto } from './archivador';
import { conseguirToken, hayPermiso } from './google';

const API = 'https://www.googleapis.com/drive/v3';
const SUBIDA = 'https://www.googleapis.com/upload/drive/v3/files';
const CARPETA = 'application/vnd.google-apps.folder';

/** Por encima de esto, subida reanudable. Una sola petición aguanta bien hasta 5 MB. */
const DE_UNA_VEZ = 5 * 1024 * 1024;

/** Trozos de 8 MB: múltiplo de 256 KB, que es lo que Drive exige. */
const TROZO = 8 * 1024 * 1024;

/** Los identificadores de carpeta, recordados por pestaña. */
const carpetas = new Map<string, string>();

/**
 * Lo que dice Drive cuando algo va mal, sacado de su propio JSON.
 *
 * Drive contesta `{"error":{"message":"..."}}` y ese texto es lo único que distingue
 * «falta un permiso» de «ese padre no existe» de «el fichero es demasiado grande». Tirarlo
 * y quedarse con el número deja a quien depura mirando un 403 sin saber cuál de las cinco
 * cosas que devuelven 403 le ha pasado.
 */
function loQueDijo(cuerpo?: string): string {
  if (!cuerpo) return '';
  try {
    const j = JSON.parse(cuerpo) as { error?: { message?: string } };
    return j.error?.message ?? '';
  } catch {
    return cuerpo.slice(0, 120);
  }
}

function traducir(estado: number, cuerpo?: string): FalloDeArchivo {
  const dijo = loQueDijo(cuerpo);
  if (estado === 401 || estado === 403) {
    /* 403 lo usa Drive tanto para «sin permiso» como para «no cabe», y distinguirlos
       importa porque la salida es distinta: volver a conectar, o hacer sitio. */
    if (/quota|storageQuota/i.test(cuerpo ?? '')) {
      return new FalloDeArchivo('sin-sitio', 'No queda espacio en tu Drive.');
    }
    return new FalloDeArchivo('sin-permiso', `Drive no lo permite${dijo ? `: ${dijo}` : '.'}`);
  }
  if (estado === 404) return new FalloDeArchivo('no-esta', 'Ese apunte ya no está en tu Drive.');
  return new FalloDeArchivo('desconocida', `Drive respondió ${estado}${dijo ? `: ${dijo}` : '.'}`);
}

/**
 * Una llamada a Drive con el token puesto.
 *
 * `interactivo` por defecto en `true` **a propósito**: todo lo que llega aquí nace de un
 * gesto —pulsar subir, soltar un fichero, abrir un apunte— y eso es lo único que permite
 * renovar el token cuando ha caducado. En falso, una subida a la hora y media fallaría con
 * «Drive no está conectado» teniendo el permiso concedido desde hace semanas.
 */
async function llamar(url: string, opciones: RequestInit = {}, interactivo = true): Promise<Response> {
  const token = await conseguirToken(interactivo);
  let r: Response;
  try {
    r = await fetch(url, {
      ...opciones,
      headers: { ...(opciones.headers ?? {}), Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    throw new FalloDeArchivo('red', 'Se cortó la conexión con Drive.', e);
  }
  if (!r.ok) throw traducir(r.status, await r.text().catch(() => ''));
  return r;
}

/** Busca una carpeta por nombre dentro de otra. `null` si no está. */
async function buscarCarpeta(nombre: string, padre?: string): Promise<string | null> {
  /* Las comillas simples del nombre romperían la consulta: Drive las escapa con barra. */
  const seguro = nombre.replace(/'/g, "\\'");
  const q = [
    `name='${seguro}'`,
    `mimeType='${CARPETA}'`,
    'trashed=false',
    padre ? `'${padre}' in parents` : "'root' in parents",
  ].join(' and ');

  const busca = await llamar(`${API}/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`);
  const { files } = (await busca.json()) as { files: Array<{ id: string }> };
  return files?.[0]?.id ?? null;
}

/** Busca una carpeta por nombre dentro de otra, y si no existe la crea. */
async function carpetaPara(nombre: string, padre?: string): Promise<string> {
  const clave = `${padre ?? 'raiz'}/${nombre}`;
  const recordada = carpetas.get(clave);
  if (recordada) return recordada;

  let id = await buscarCarpeta(nombre, padre);
  if (!id) {
    const crea = await llamar(`${API}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nombre, mimeType: CARPETA, parents: [padre ?? 'root'] }),
    });
    id = ((await crea.json()) as { id: string }).id;
  }

  carpetas.set(clave, id);
  return id;
}

/** Cómo se llamó esta carpeta antes, para no dejar huérfano lo ya subido. */
const NOMBRE_VIEJO = 'Apuntes';
const NOMBRE = 'Asignaturas';

/**
 * La carpeta de las asignaturas, renombrando la vieja si existe.
 *
 * Crear la nueva sin más habría dejado dos carpetas en el Drive: una `Apuntes` con todo lo
 * de antes y una `Asignaturas` vacía. Los ficheros viejos seguirían abriéndose —la ficha
 * guarda su identificador, no su ruta— pero quien entrara en Drive vería el trabajo
 * repartido en dos sitios sin saber por qué.
 *
 * Renombrarla se puede porque la creó esta misma aplicación, que es exactamente lo que
 * `drive.file` permite. Y ocurre **una sola vez**: a la siguiente ya no hay nada que
 * renombrar.
 */
async function carpetaDeAsignaturas(raiz: string): Promise<string> {
  const clave = `${raiz}/${NOMBRE}`;
  const recordada = carpetas.get(clave);
  if (recordada) return recordada;

  const vieja = await buscarCarpeta(NOMBRE_VIEJO, raiz);
  if (vieja) {
    await llamar(`${API}/files/${vieja}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: NOMBRE }),
    });
    carpetas.set(clave, vieja);
    return vieja;
  }

  return carpetaPara(NOMBRE, raiz);
}

async function carpetaDeAsignatura(clave: string): Promise<string> {
  const raiz = await carpetaPara('Archicel');
  const asignaturas = await carpetaDeAsignaturas(raiz);
  const nombre = ASIGNATURAS[clave as keyof typeof ASIGNATURAS]?.nombre ?? clave;
  return carpetaPara(nombre, asignaturas);
}

/**
 * La subida reanudable, con progreso.
 *
 * Va con `XMLHttpRequest` y no con `fetch` por una razón concreta: `fetch` **no informa
 * del progreso de subida**. Se puede hacer con flujos, pero no en todos los navegadores y
 * con bastante más código. Aquí el progreso no es un adorno: es lo único que distingue
 * «está subiendo una lámina de 60 MB» de «se ha colgado».
 */
function enviarTrozo(
  url: string,
  trozo: Blob,
  desde: number,
  total: number,
  alAvanzar?: (tanto: number) => void,
): Promise<{ hecho: boolean; id?: string }> {
  return new Promise((resolver, rechazar) => {
    const pet = new XMLHttpRequest();
    pet.open('PUT', url, true);
    pet.setRequestHeader('Content-Range', `bytes ${desde}-${desde + trozo.size - 1}/${total}`);

    pet.upload.onprogress = (e) => {
      if (e.lengthComputable) alAvanzar?.(Math.min(1, (desde + e.loaded) / total));
    };
    pet.onerror = () => rechazar(new FalloDeArchivo('red', 'Se cortó la subida.'));
    pet.onload = () => {
      /* 308 significa «voy bien, sigue con el siguiente trozo». No es un error aunque lo
         parezca por el número. */
      if (pet.status === 308) return resolver({ hecho: false });
      if (pet.status === 200 || pet.status === 201) {
        try {
          return resolver({ hecho: true, id: JSON.parse(pet.responseText).id as string });
        } catch {
          return rechazar(new FalloDeArchivo('desconocida', 'Drive respondió algo que no se entiende.'));
        }
      }
      rechazar(traducir(pet.status, pet.responseText));
    };
    pet.send(trozo);
  });
}

/**
 * De quién es el Drive conectado.
 *
 * Hace falta porque cada persona conecta el suyo: «En tu Drive» no dice cuál, y con dos
 * cuentas de Google abiertas en el mismo navegador —que es lo normal— es perfectamente
 * posible conceder con la que no era y no enterarse hasta que los apuntes no aparecen
 * donde deberían.
 *
 * `about` funciona con `drive.file` sin pedir ningún permiso extra: devuelve quién ha
 * autorizado, no una lista de nada.
 *
 * Se recuerda por pestaña: la cuenta no cambia sin volver a conectar.
 */
let quienEs: string | null = null;

export async function deQuienEsElDrive(): Promise<string | null> {
  if (quienEs) return quienEs;
  if (!hayPermiso()) return null;
  try {
    const r = await llamar(`${API}/about?fields=user(emailAddress,displayName)`, {}, false);
    const { user } = (await r.json()) as { user?: { emailAddress?: string; displayName?: string } };
    quienEs = user?.emailAddress ?? user?.displayName ?? null;
    return quienEs;
  } catch {
    /* Saber de quién es es una comodidad, no un requisito: si falla, la pantalla dice
       «En tu Drive» como antes y todo lo demás sigue funcionando. */
    return null;
  }
}

/** Al desconectar hay que olvidarlo, o la pantalla seguiría enseñando la cuenta anterior. */
export function olvidarQuien(): void {
  quienEs = null;
}

export function crearArchivadorDrive(): Archivador {
  return {
    nombre: 'drive',

    disponible: () => hayPermiso(),

    async conectar() {
      await conseguirToken(true);
    },

    async subir(fichero, destino: Destino, alAvanzar) {
      /*
       * El token, **antes que nada**, y ese orden es el arreglo.
       *
       * Renovarlo puede abrir una ventana de Google, y un navegador solo lo permite
       * mientras dura el permiso que deja un gesto — unos segundos desde el clic o desde
       * soltar el fichero. Buscando primero la carpeta se gastaban dos o tres peticiones
       * de red en ese presupuesto, y la ventana llegaba tarde y la bloqueaban.
       *
       * El síntoma era exactamente «después de una hora, la primera subida falla». Con el
       * permiso ya concedido, esa ventana se abre y se cierra sin enseñar nada.
       */
      await conseguirToken(true);

      /* La carpeta que eligió la usuaria, y si no hay ninguna, la de la asignatura. */
      const padre = destino.padre?.proveedor === 'drive'
        ? destino.padre.id
        : await carpetaDeAsignatura(destino.asignatura);
      const meta = {
        name: fichero.name,
        parents: [padre],
        /* Sin tipo, Drive adivina por la extensión y a veces se equivoca. */
        ...(fichero.type ? { mimeType: fichero.type } : {}),
      };

      /* ── lo pequeño, de una vez ── */
      if (fichero.size <= DE_UNA_VEZ) {
        const cuerpo = new FormData();
        cuerpo.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
        cuerpo.append('file', fichero);
        const r = await llamar(`${SUBIDA}?uploadType=multipart&fields=id`, { method: 'POST', body: cuerpo });
        alAvanzar?.(1);
        return { proveedor: 'drive', id: ((await r.json()) as { id: string }).id };
      }

      /* ── lo grande, por trozos y reanudable ── */
      const sesion = await llamar(`${SUBIDA}?uploadType=resumable&fields=id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(meta),
      });
      /*
       * Una respuesta de otro origen **solo deja leer siete cabeceras** salvo que el
       * servidor exponga más, y `Location` no está entre esas siete. Google la expone,
       * pero si algún día deja de hacerlo esto devuelve `null` y la subida se cae sin
       * pista — de ahí que el mensaje diga qué cabecera falta y no «no se pudo».
       */
      const url = sesion.headers.get('Location');
      if (!url) {
        throw new FalloDeArchivo(
          'desconocida',
          'Drive no devolvió la dirección de subida (cabecera Location no legible).',
        );
      }

      let desde = 0;
      for (;;) {
        const hasta = Math.min(desde + TROZO, fichero.size);
        const r = await enviarTrozo(url, fichero.slice(desde, hasta), desde, fichero.size, alAvanzar);
        if (r.hecho) return { proveedor: 'drive', id: r.id as string };
        desde = hasta;
        if (desde >= fichero.size) throw new FalloDeArchivo('desconocida', 'La subida terminó sin confirmación.');
      }
    },

    async crearCarpeta(nombre, destino: Destino) {
      await conseguirToken(true);
      const padre = destino.padre?.proveedor === 'drive'
        ? destino.padre.id
        : await carpetaDeAsignatura(destino.asignatura);
      const r = await llamar(`${API}/files?fields=id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nombre, mimeType: CARPETA, parents: [padre] }),
      });
      return { proveedor: 'drive' as const, id: ((await r.json()) as { id: string }).id };
    },

    async renombrar(remoto: Remoto, nombre: string) {
      if (remoto.proveedor !== 'drive') return;
      await llamar(`${API}/files/${encodeURIComponent(remoto.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nombre }),
      });
    },

    async mover(remoto: Remoto, desde: Remoto | null, hasta: Remoto | null, destino: Destino) {
      if (remoto.proveedor !== 'drive') return;
      /*
       * Drive no tiene «mover»: tiene **padres**, y mover es quitar uno y poner otro en la
       * misma llamada. Si se hiciera en dos, un fallo entre medias dejaría el fichero en
       * los dos sitios o en ninguno.
       *
       * La raíz de la asignatura es un destino como otro cualquiera, solo que hay que
       * preguntársela a Drive en vez de recibirla.
       */
      const raiz = await carpetaDeAsignatura(destino.asignatura);
      const nuevo = hasta?.proveedor === 'drive' ? hasta.id : raiz;
      const viejo = desde?.proveedor === 'drive' ? desde.id : raiz;
      if (nuevo === viejo) return;

      await llamar(
        `${API}/files/${encodeURIComponent(remoto.id)}?addParents=${nuevo}&removeParents=${viejo}&fields=id`,
        { method: 'PATCH' },
      );
    },

    async borrar(remoto: Remoto) {
      if (remoto.proveedor !== 'drive') throw new FalloDeArchivo('no-esta', 'Ese apunte no está en Drive.');
      /*
       * A la papelera, no destruido.
       *
       * Treinta días para arrepentirse, que es lo que hace Drive con todo lo demás. Un
       * `DELETE` de verdad borraría sin vuelta atrás desde un botón que en el resto del
       * sistema significa «se puede recuperar».
       */
      await llamar(`${API}/files/${encodeURIComponent(remoto.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trashed: true }),
      });
    },

    async enlace(remoto: Remoto) {
      if (remoto.proveedor !== 'drive') throw new FalloDeArchivo('no-esta', 'Ese apunte no está en Drive.');
      /*
       * Se descarga y se envuelve en un objeto local, en vez de devolver una URL de Drive.
       *
       * Dos motivos. Una dirección de Drive con el token dentro sería un enlace que da
       * acceso a quien lo copie de la barra; y sin token no se puede pintar en un `<img>`
       * ni en un `<iframe>`, porque esas etiquetas no saben mandar una cabecera de
       * autorización. Bajarlo aquí resuelve las dos cosas a la vez.
       */
      const r = await llamar(`${API}/files/${encodeURIComponent(remoto.id)}?alt=media`);
      return URL.createObjectURL(await r.blob());
    },

    soltar(url) {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    },
  };
}
