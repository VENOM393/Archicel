/**
 * Un icono por tipo de fichero.
 *
 * ## Por qué llevan color, si el contrato lo restringe
 *
 * `docs/design/DESIGN.md` prohíbe **un segundo color saturado**, y una lista donde cada
 * fila inventa un acento nuevo es exactamente eso. Pero una lista donde todo se dibuja en
 * el mismo gris tampoco sirve: reconocer «esto es el PDF de teoría» de un vistazo es medio
 * trabajo de esta pantalla.
 *
 * La salida no es inventar colores: es **reutilizar la paleta de la casa**. Cada tipo toma
 * uno de los `--c-*` que ya usan las asignaturas, y lo usa al 16 % de relleno con el trazo
 * a plena intensidad. Así no entra ni un tono nuevo en el sistema, y el color de la
 * asignatura —que es el que manda en la página— sigue siendo el único saturado de verdad.
 *
 * ## Por qué dos siluetas y no una
 *
 * Lo que es un documento se dibuja como una hoja con la esquina doblada, y lo que no lo es
 * —una imagen, un vídeo, un audio, un comprimido— tiene su propia forma. Trece hojas
 * idénticas con un garabato distinto dentro obligan a leer el garabato; una silueta
 * distinta se reconoce sin leer nada.
 *
 * ## Lo que se dibuja y lo que no
 *
 * Solo lo que puede recibir una estudiante de arquitectura. Un `.dwg` y un `.skp` tienen su
 * icono porque van a llegar; un `.exe` no, porque si llega, algo ha ido mal y lo correcto
 * es que se vea como lo que es: un fichero cualquiera.
 */

import type { ReactNode } from 'react';

export type ClaseFichero =
  | 'imagen'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'documento'
  | 'hoja'
  | 'presentacion'
  | 'texto'
  | 'codigo'
  | 'comprimido'
  | 'plano'
  | 'modelo'
  | 'otro';

interface Tipo {
  clase: ClaseFichero;
  /** Cómo se llama en pantalla. */
  nombre: string;
  /** Un color de la paleta de la casa. Nunca uno nuevo. */
  color: string;
  mime: string[];
  ext: string[];
}

/**
 * El catálogo, en orden de comprobación.
 *
 * El MIME se mira primero y la extensión después, no al revés: el navegador manda el MIME
 * vacío más de lo que parece —pasa con `.heic`, con `.dwg` y con lo que venga de un disco
 * de red— y entonces el nombre es lo único que queda. Al revés se perdería información que
 * estaba delante.
 */
const CATALOGO: Tipo[] = [
  {
    clase: 'imagen',
    nombre: 'Imagen',
    color: 'cian',
    mime: ['image/'],
    ext: ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.heic', '.heif', '.bmp', '.tif', '.tiff', '.svg'],
  },
  {
    clase: 'video',
    nombre: 'Vídeo',
    color: 'violeta',
    mime: ['video/'],
    ext: ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'],
  },
  {
    clase: 'audio',
    nombre: 'Audio',
    color: 'rosa',
    mime: ['audio/'],
    ext: ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'],
  },
  { clase: 'pdf', nombre: 'PDF', color: 'rojo', mime: ['application/pdf'], ext: ['.pdf'] },
  {
    clase: 'documento',
    nombre: 'Documento',
    color: 'azul',
    mime: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml',
      'application/msword',
      'application/vnd.oasis.opendocument.text',
      'application/rtf',
    ],
    ext: ['.docx', '.doc', '.odt', '.rtf', '.pages'],
  },
  {
    clase: 'hoja',
    nombre: 'Hoja de cálculo',
    color: 'verde',
    mime: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml',
      'application/vnd.ms-excel',
      'application/vnd.oasis.opendocument.spreadsheet',
      'text/csv',
    ],
    ext: ['.xlsx', '.xls', '.ods', '.csv', '.numbers'],
  },
  {
    clase: 'presentacion',
    nombre: 'Presentación',
    color: 'naranja',
    mime: [
      'application/vnd.openxmlformats-officedocument.presentationml',
      'application/vnd.ms-powerpoint',
      'application/vnd.oasis.opendocument.presentation',
    ],
    ext: ['.pptx', '.ppt', '.odp', '.key'],
  },
  {
    clase: 'comprimido',
    nombre: 'Comprimido',
    color: 'arena',
    mime: ['application/zip', 'application/x-rar', 'application/x-7z', 'application/gzip'],
    ext: ['.zip', '.rar', '.7z', '.tar', '.gz'],
  },
  /* Lo de una escuela de arquitectura, que es lo que de verdad va a llegar aquí. */
  {
    clase: 'plano',
    nombre: 'Plano',
    color: 'ambar',
    mime: ['application/acad', 'image/vnd.dwg', 'application/dxf'],
    ext: ['.dwg', '.dxf', '.dwf', '.rvt', '.rfa', '.pln'],
  },
  {
    clase: 'modelo',
    nombre: 'Modelo 3D',
    color: 'menta',
    mime: ['model/'],
    ext: ['.skp', '.3ds', '.obj', '.fbx', '.stl', '.blend', '.3dm', '.max'],
  },
  {
    clase: 'codigo',
    nombre: 'Código',
    color: 'indigo',
    mime: ['application/json', 'text/html', 'text/css', 'application/javascript'],
    ext: ['.json', '.html', '.css', '.js', '.ts', '.py', '.xml'],
  },
  { clase: 'texto', nombre: 'Texto', color: 'piedra', mime: ['text/'], ext: ['.txt', '.md', '.rtfd'] },
];

const PORDEFECTO: Pick<Tipo, 'clase' | 'nombre' | 'color'> = { clase: 'otro', nombre: 'Archivo', color: 'piedra' };

/** Qué es un fichero, mirando primero su MIME y después su nombre. */
export function tipoDeFichero(mime: string, nombre: string): Pick<Tipo, 'clase' | 'nombre' | 'color'> {
  const m = (mime || '').toLowerCase();
  if (m) for (const t of CATALOGO) if (t.mime.some((x) => m.startsWith(x))) return t;

  const i = nombre.lastIndexOf('.');
  const ext = i > 0 ? nombre.slice(i).toLowerCase() : '';
  if (ext) for (const t of CATALOGO) if (t.ext.includes(ext)) return t;

  return PORDEFECTO;
}

/** Cómo se llama en pantalla. */
export function nombreDeTipo(mime: string, nombre: string): string {
  return tipoDeFichero(mime, nombre).nombre;
}

/** Si se puede enseñar dentro de la página o hay que abrirlo fuera. */
export function seVeDentro(mime: string, nombre: string): 'imagen' | 'pdf' | 'video' | 'no' {
  const { clase } = tipoDeFichero(mime, nombre);
  if (clase === 'imagen') return 'imagen';
  if (clase === 'pdf') return 'pdf';
  if (clase === 'video') return 'video';
  return 'no';
}

/* ───────────────────────── los dibujos ─────────────────────────

   Todos con el mismo trazo —1.5, extremos redondeados— y sobre una caja de 24. La hoja de
   los documentos es la misma en todos: lo único que cambia es lo que lleva dentro, y ese
   es el truco que los hace familia sin que se confundan entre ellos.                    */

/** La hoja con la esquina doblada. La comparten todos los que son documentos. */
function Hoja({ children }: { children?: ReactNode }) {
  return (
    <>
      <path d="M13.8 3.2H7.4A1.9 1.9 0 0 0 5.5 5.1v13.8a1.9 1.9 0 0 0 1.9 1.9h9.2a1.9 1.9 0 0 0 1.9-1.9V7.5Z" />
      {/* El doblez, que es lo que hace que se lea como papel y no como una pastilla. */}
      <path d="M13.8 3.2v3.4a.9.9 0 0 0 .9.9h3.8" />
      {children}
    </>
  );
}

export function IconoDeFichero({ clase, tam = 16 }: { clase: ClaseFichero; tam?: number }) {
  const comun = {
    width: tam,
    height: tam,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (clase) {
    /* Un marco con un horizonte y un sol: la fotografía más pequeña que se puede dibujar. */
    case 'imagen':
      return (
        <svg {...comun}>
          <rect x="3.2" y="4.6" width="17.6" height="14.8" rx="2.6" />
          <circle cx="8.9" cy="9.8" r="1.5" />
          <path d="m4.2 17.4 4.3-4.3a1.7 1.7 0 0 1 2.4 0l5.2 5.2" />
          <path d="m14.4 14.2 1.6-1.6a1.7 1.7 0 0 1 2.4 0l2.2 2.2" />
        </svg>
      );

    /* La pantalla y el triángulo de reproducir, que es universal y no hace falta explicar. */
    case 'video':
      return (
        <svg {...comun}>
          <rect x="3.2" y="5.2" width="17.6" height="13.6" rx="2.6" />
          <path d="M10.4 9.6 15 12l-4.6 2.4Z" fill="currentColor" stroke="none" />
          <path d="M3.2 8.4h17.6M3.2 15.6h17.6" opacity=".35" />
        </svg>
      );

    /* Una onda dentro de un círculo: suena, y no hace falta una nota musical. */
    case 'audio':
      return (
        <svg {...comun}>
          <circle cx="12" cy="12" r="8.8" />
          <path d="M8.2 10.4v3.2M10.8 8.6v6.8M13.4 10v4M16 11.2v1.6" />
        </svg>
      );

    /* Las dos barras de una lectura: lo que se ve al abrir un PDF de teoría. */
    case 'pdf':
      return (
        <svg {...comun}>
          <Hoja>
            <path d="M8.4 13.4h7.2M8.4 16.4h4.6" />
            <path d="M8.4 10.4h2.6" opacity=".45" />
          </Hoja>
        </svg>
      );

    /* Líneas de texto de distinta longitud: un documento escrito, no un formulario. */
    case 'documento':
      return (
        <svg {...comun}>
          <Hoja>
            <path d="M8.4 11.6h7.2M8.4 14.4h7.2M8.4 17.2h4.4" />
          </Hoja>
        </svg>
      );

    /* La cuadrícula, que es lo único que hay que ver para saber que son celdas. */
    case 'hoja':
      return (
        <svg {...comun}>
          <Hoja>
            <path d="M8.2 11.8h7.6M8.2 15.2h7.6M12 11.8v6.6" />
            <path d="M8.2 11.8v6.6h7.6v-6.6Z" opacity=".45" />
          </Hoja>
        </svg>
      );

    /* Una diapositiva dentro de la hoja: la forma de una presentación proyectada. */
    case 'presentacion':
      return (
        <svg {...comun}>
          <Hoja>
            <rect x="8.2" y="11.6" width="7.6" height="5" rx="1" />
            <path d="M12 16.6v2M10.4 18.6h3.2" />
          </Hoja>
        </svg>
      );

    /* Una caja con su cinta: lo que hay dentro va empaquetado. */
    case 'comprimido':
      return (
        <svg {...comun}>
          <path d="M3.6 8.2 12 4.4l8.4 3.8v7.6L12 19.6 3.6 15.8Z" />
          <path d="M3.6 8.2 12 12l8.4-3.8M12 12v7.6" />
          <path d="M7.8 6.3 16.2 10" opacity=".45" />
        </svg>
      );

    /* Una planta con su cota: es lo que dibuja esta carrera, y merece su propio icono. */
    case 'plano':
      return (
        <svg {...comun}>
          <path d="M4 5.4h16v13.2H4Z" />
          <path d="M4 10.2h6.4V5.4M10.4 10.2H20M14.6 10.2v8.4" />
          <path d="M6 13.2h2.6M6 15.6h4.4" opacity=".5" />
        </svg>
      );

    /* Un volumen en axonometría: lo que sale de SketchUp o de Rhino. */
    case 'modelo':
      return (
        <svg {...comun}>
          <path d="M12 3.6 20.2 8v8L12 20.4 3.8 16V8Z" />
          <path d="M3.8 8 12 12.4 20.2 8M12 12.4v8" />
        </svg>
      );

    /* Los dos ángulos de siempre. No hay forma mejor de decir «esto es código». */
    case 'codigo':
      return (
        <svg {...comun}>
          <Hoja>
            <path d="m10.4 12.8-1.8 1.8 1.8 1.8M13.6 12.8l1.8 1.8-1.8 1.8" />
          </Hoja>
        </svg>
      );

    /* Menos líneas que un documento y más cortas: una nota, no una memoria. */
    case 'texto':
      return (
        <svg {...comun}>
          <Hoja>
            <path d="M8.4 12.4h5.4M8.4 15.4h7.2M8.4 18.2h3.4" opacity=".8" />
          </Hoja>
        </svg>
      );

    /* La hoja sola. Lo que no sabemos qué es se dibuja como lo que sí sabemos: un fichero. */
    default:
      return (
        <svg {...comun}>
          <Hoja />
        </svg>
      );
  }
}
