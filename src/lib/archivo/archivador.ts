/**
 * El contrato del archivador.
 *
 * La misma idea que el almacén, aplicada a los bytes: **la interfaz no habla nunca con
 * Google Drive**. Habla con esto, y por debajo hay una implementación u otra.
 *
 * Es lo que permitió que el almacén pasara de `localStorage` a Firestore sin reescribir
 * una sola vista, y lo que permitió que los apuntes pasaran del navegador a Drive igual.
 * Hoy todo lo nuevo va a Drive; el archivador del navegador sigue existiendo solo para
 * abrir y borrar lo que se guardó ahí antes. El día que Drive se sustituya por otra cosa,
 * se escribe otro archivador y ninguna pantalla se entera.
 *
 * ## El reparto con el almacén
 *
 * ```
 *   Almacén   ──  la ficha:  nombre, tipo, tamaño, asignatura, orden
 *   Archivador ──  el byte:   el PDF, el JPG, el DOCX
 * ```
 *
 * El almacén nunca guarda un byte de contenido; el archivador nunca guarda lógica de la
 * aplicación. La ficha (`Apunte`) es lo que los une, y lleva dentro un `remoto` que dice
 * qué proveedor tiene los bytes y con qué identificador encontrarlos.
 *
 * Por eso la pantalla se dibuja entera sin una sola llamada al archivador: los nombres,
 * los tipos y el orden salen del almacén, que ya es tiempo real y ya funciona sin
 * conexión. Al archivador solo se va al subir, al abrir, al borrar y al organizar.
 */

import type { Apunte } from '@/lib/data';

/** Dónde encontrar los bytes. El proveedor va dentro porque conviven dos. */
export type Remoto = Apunte['remoto'];

/** Dónde va un fichero, dicho en términos del producto y no del proveedor. */
export interface Destino {
  /** La clave de la asignatura en el catálogo del curso. */
  asignatura: string;
  /**
   * La carpeta de dentro, si la hay.
   *
   * Va el `Remoto` y no el identificador de la ficha porque quien tiene que entenderlo es
   * el proveedor: al archivador no le importa cómo llame Archicel a esa carpeta, le importa
   * cuál es en Drive.
   */
  padre?: Remoto;
}

/**
 * Por qué falla, dicho con nombres que la interfaz pueda traducir.
 *
 * Un `Error` pelado obliga a cada pantalla a leer el mensaje del proveedor para decidir
 * qué enseñar, y ese mensaje cambia sin avisar. Un código no cambia. Y cada código existe
 * porque **su arreglo es distinto**: un 403 puede ser «vuelve a conectar», «activa la API»,
 * «espera un minuto» o «vacía la papelera», y meterlos en el mismo saco es decirle a quien
 * lo lee que haga lo que no lo arregla.
 */
export type CausaFallo =
  | 'sin-conexion' // no hay permiso utilizable y no se pudo conseguir: ventana cerrada, bloqueada…
  | 'caducada' // el proveedor rechazó el permiso que había (revocado o caducado antes de hora)
  | 'sin-permiso' // el permiso existe pero no alcanza: otro alcance, otro dueño, una política
  | 'api-apagada' // la API del proveedor está desactivada en el proyecto
  | 'limite' // demasiadas peticiones, y ya se reintentó
  | 'sin-sitio' // no cabe: cuota de almacenamiento llena
  | 'no-esta' // lo que se pidió ya no existe
  | 'sin-carpeta' // la carpeta de destino ya no existe
  | 'red' // se cayó la conexión a mitad
  | 'servidor' // el proveedor falló por su cuenta (5xx), y ya se reintentó
  | 'desconocida';

/**
 * Lo que dijo el proveedor, tal cual. La pantalla traduce la `causa`, pero enseña también
 * esto: un «no se pudo» genérico escondió durante tres rondas que la API estaba apagada, y
 * el texto de Drive lo decía con todas las letras.
 */
export interface DetalleFallo {
  /** El código HTTP, si lo hubo. */
  estado?: number;
  /** La razón estructurada del proveedor: `storageQuotaExceeded`, `accessNotConfigured`… */
  razon?: string;
  /** Su mensaje, sin traducir. */
  dijo?: string;
}

export class FalloDeArchivo extends Error {
  constructor(
    readonly causa: CausaFallo,
    mensaje: string,
    readonly original?: unknown,
    readonly detalle: DetalleFallo = {},
  ) {
    super(mensaje);
    this.name = 'FalloDeArchivo';
  }
}

export interface OpcionesDeLectura {
  /** El tipo MIME de la ficha, por si el proveedor no lo dice. */
  tipo?: string;
  /** El tamaño de la ficha, por si el proveedor no lo dice: sin él no hay fracción. */
  tam?: number;
  /**
   * Lo que ha llegado hasta ahora —un `Blob` parcial— y la fracción de 0 a 1. Con eso una
   * imagen se va pintando mientras baja en vez de esperar al último byte.
   */
  alAvanzar?: (hastaAhora: Blob, tanto: number) => void;
}

export interface Archivador {
  /** Cómo se llama, para que la interfaz pueda decir dónde se está guardando. */
  readonly nombre: 'local' | 'drive';

  /**
   * Si se puede usar **ahora mismo**, sin pedir nada a nadie.
   *
   * Separado de `conectar` a propósito: la pantalla necesita saber si ofrecer el botón de
   * conectar antes de que nadie pulse nada.
   */
  disponible(): boolean;

  /**
   * Pide lo que haga falta para poder usarlo. Es lo único que puede abrir una ventana
   * del proveedor, y solo se llama cuando la usuaria ha hecho algo que lo justifique.
   */
  conectar(): Promise<void>;

  /**
   * Sube un fichero y devuelve dónde ha quedado.
   *
   * `alAvanzar` recibe de 0 a 1. Si la misma subida (el mismo `File`) se vuelve a pedir
   * después de un corte, el proveedor puede **seguir donde se quedó** en vez de empezar de
   * cero, y al mismo destino que la primera vez.
   */
  subir(fichero: File, destino: Destino, alAvanzar?: (tanto: number) => void): Promise<Remoto>;

  /**
   * Crea una carpeta y devuelve dónde ha quedado.
   *
   * Una carpeta de Archicel es una carpeta de verdad en el proveedor, para que quien abra
   * Drive vea el mismo árbol que ve en la aplicación. Por eso, igual que subir, exige Drive
   * conectado: sin él la pantalla ofrece conectar, no organizar.
   */
  crearCarpeta(nombre: string, destino: Destino): Promise<Remoto>;

  /** Le cambia el nombre. Vale para un fichero y para una carpeta. */
  renombrar(remoto: Remoto, nombre: string): Promise<void>;

  /**
   * Lo mueve a otra carpeta. `null` significa la raíz de la asignatura.
   *
   * `desde` hace falta porque Drive no mueve: **quita un padre y pone otro**, y para
   * quitarlo hay que saber cuál era. Pedirlo aquí evita una llamada de más solo para
   * averiguar algo que quien llama ya sabe.
   */
  mover(remoto: Remoto, desde: Remoto | null, hasta: Remoto | null, destino: Destino): Promise<void>;

  /**
   * Lo quita. Qué signifique «quitar» lo decide el proveedor: en Drive, la papelera.
   *
   * `'hecho'` solo si el proveedor lo ha confirmado. `'no-estaba'` si no lo encuentra,
   * que **no es lo mismo**: en Drive puede ser que se borrara desde allí o que lo subiera
   * otra cuenta de Google y siga vivo en su Drive. Quien llama decide —preguntando— si quita
   * la ficha igualmente. Cualquier otro fallo lanza, y la ficha se conserva: borrar la ficha
   * de algo que sigue en Drive lo deja vivo y sin nada que lo enlace.
   */
  borrar(remoto: Remoto): Promise<'hecho' | 'no-estaba'>;

  /**
   * Los bytes, para ver o descargar.
   *
   * Devuelve un `Blob` y no una dirección: la dirección `blob:` la crea y la suelta quien
   * pinta, que es quien sabe cuándo deja de hacer falta. **Nunca se guarda en el
   * almacén**: una dirección guardada es un enlace roto al recargar, y si no caducara sería
   * una puerta pública a un apunte.
   */
  leer(remoto: Remoto, opciones?: OpcionesDeLectura): Promise<Blob>;
}

/**
 * El tamaño, dicho como lo diría una persona.
 *
 * En base 1024 y no 1000, que es como lo cuenta el sistema operativo: si Windows dice
 * 2,4 MB y Archicel dijera 2,5 MB, la que parece que se equivoca es Archicel.
 */
export function pesoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const k = bytes / 1024;
  if (k < 1024) return `${Math.round(k)} kB`;
  const m = k / 1024;
  return m < 10 ? `${m.toFixed(1).replace('.', ',')} MB` : `${Math.round(m)} MB`;
}
