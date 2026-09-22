/**
 * El contrato del archivador.
 *
 * La misma idea que el almacén, aplicada a los bytes: **la interfaz no habla nunca con
 * Google Drive**. Habla con esto, que tiene cuatro verbos, y por debajo hay una
 * implementación u otra. Cambiar de una a otra es una línea y ninguna pantalla se entera.
 *
 * Es lo que ha permitido que el almacén pasara de `localStorage` a Firestore sin
 * reescribir una sola vista, y es lo que va a permitir que los apuntes pasen del
 * navegador a Drive igual. También es lo que hace que la página de una asignatura se
 * pueda construir y probar **hoy**, sin que nadie haya concedido todavía un permiso de
 * Google.
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
 * conexión. Al archivador solo se va al subir, al abrir y al borrar.
 */

import type { Apunte } from '@/lib/data';

/** Dónde encontrar los bytes. El proveedor va dentro porque un día habrá dos a la vez. */
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
 * qué enseñar, y ese mensaje cambia sin avisar. Un código no cambia.
 */
export type CausaFallo =
  | 'sin-permiso' // todavía no se ha conectado, o se ha revocado
  | 'sin-sitio' // no cabe: cuota llena
  | 'demasiado-grande' // el fichero se pasa del tope
  | 'no-esta' // se pidió algo que ya no existe
  | 'red' // se cayó la conexión a mitad
  | 'desconocida';

export class FalloDeArchivo extends Error {
  constructor(
    readonly causa: CausaFallo,
    mensaje: string,
    readonly original?: unknown,
  ) {
    super(mensaje);
    this.name = 'FalloDeArchivo';
  }
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
   * `alAvanzar` recibe de 0 a 1. Es opcional porque no todos los proveedores saben
   * informar del progreso, y una barra que no se mueve es peor que no tener barra.
   */
  subir(fichero: File, destino: Destino, alAvanzar?: (tanto: number) => void): Promise<Remoto>;

  /**
   * Crea una carpeta y devuelve dónde ha quedado.
   *
   * Existe en el contrato —y no solo en el de Drive— porque la usuaria tiene que poder
   * organizarse **también sin haber conectado nada**. Una carpeta que solo funciona con
   * Drive puesto convierte una decisión de orden en una decisión de infraestructura.
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

  /** Lo quita. Qué signifique «quitar» lo decide el proveedor: puede ser una papelera. */
  borrar(remoto: Remoto): Promise<void>;

  /**
   * Una dirección para ver o descargar.
   *
   * **Caduca, y por eso no se guarda en el almacén.** Una URL guardada es un enlace roto
   * dentro de una hora; y si no caducara sería peor, porque sería una dirección pública a
   * un apunte guardada en un sitio donde nadie espera encontrarla.
   *
   * Quien la pide se encarga de soltarla con `soltar` cuando termine: en el archivador
   * local es un objeto en memoria y no se libera solo.
   */
  enlace(remoto: Remoto): Promise<string>;

  /** Libera lo que `enlace` haya reservado. Sin esto, el navegador se queda los bytes. */
  soltar(url: string): void;
}

/** Lo que Archicel acepta como apunte, y cómo se llama cada cosa en pantalla. */
export const TIPOS_ACEPTADOS: Array<{ mime: string; ext: string[]; nombre: string }> = [
  { mime: 'image/', ext: ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.heic'], nombre: 'Imagen' },
  { mime: 'application/pdf', ext: ['.pdf'], nombre: 'PDF' },
  { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: ['.docx'], nombre: 'Documento' },
  { mime: 'application/msword', ext: ['.doc'], nombre: 'Documento' },
  { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ext: ['.pptx'], nombre: 'Presentación' },
  { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: ['.xlsx'], nombre: 'Hoja' },
  { mime: 'text/', ext: ['.txt', '.md'], nombre: 'Texto' },
];

/**
 * Cómo se llama un tipo en pantalla.
 *
 * Se mira primero el MIME y **después la extensión**, en ese orden y no al revés: el
 * navegador a veces manda el MIME vacío —pasa con `.heic` y con ficheros que vienen de un
 * disco de red— y entonces lo único que queda es el nombre. Devolver «Archivo» cuando se
 * podía saber que era un PDF es perder información que estaba ahí.
 */
export function nombreDeTipo(mime: string, nombre: string): string {
  for (const t of TIPOS_ACEPTADOS) if (mime && mime.startsWith(t.mime)) return t.nombre;
  const ext = nombre.slice(nombre.lastIndexOf('.')).toLowerCase();
  for (const t of TIPOS_ACEPTADOS) if (t.ext.includes(ext)) return t.nombre;
  return 'Archivo';
}

/** Si se puede enseñar dentro de la página o hay que abrirlo fuera. */
export function seVeDentro(mime: string, nombre: string): 'imagen' | 'pdf' | 'no' {
  const ext = nombre.slice(nombre.lastIndexOf('.')).toLowerCase();
  if (mime.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'].includes(ext)) return 'imagen';
  if (mime === 'application/pdf' || ext === '.pdf') return 'pdf';
  return 'no';
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
