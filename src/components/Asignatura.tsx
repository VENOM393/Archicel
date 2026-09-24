'use client';

/**
 * La página de una asignatura.
 *
 * No es un tablero de widgets: es **una página compuesta**, con una jerarquía que manda.
 * El contrato visual lo prohíbe expresamente —«rejilla de tarjetas idénticas como
 * estructura de pantalla»— y aquí la tentación era exactamente esa, porque el contenido
 * son ficheros y los ficheros piden cuadrícula.
 *
 * Así que la pantalla tiene un protagonista y dos acompañantes:
 *
 *   1 · **La portada.** El nombre a tamaño de alzado, y debajo la semana dibujada con las
 *       clases de esta asignatura marcadas. Es lo que hace que la página sea *de esta
 *       asignatura* y no una lista con un título encima.
 *   2 · **Lo que viene.** Sus entregas y exámenes, que es la pregunta que se hace quien
 *       abre esto un lunes.
 *   3 · **Los apuntes.** El sitio de trabajo, en una sola superficie: las filas se
 *       separan con una línea de 1 px y un cambio de relleno, nunca con un segundo
 *       cristal. Cristal sobre cristal está prohibido y además se ve sucio.
 *
 * Una sola acción sólida en toda la pantalla, y es la que crea algo: subir —o, sin Drive,
 * conectarlo—. Abrir, borrar y volver son contorno o fantasma.
 */

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as mo from 'motion/react-m';
import { AnimatePresence } from 'motion/react';

import { APARECER, ORQUESTA, PIEZA, VELO, HOJA, MUELLE, CURVA, TIEMPO } from '@/lib/ui/movimiento';
import { Icono, TIPOS } from '@/lib/ui/catalogo';
import { Button } from '@/components/ui/button';
import { useAhora, useApuntes, useCarpetas, useEventos } from '@/hooks/useDatos';
import { useDialogo } from '@/hooks/useDialogo';
import { useUI } from '@/lib/ui/contexto';
import { useArchicel } from '@/lib/firebase/sesion';
import {
  alCambiarDrive,
  arbolDe,
  deQuienEsElDrive,
  driveConectado,
  elArchivador,
  explicar,
  pesoLegible,
  planDeBorrado,
  precargar,
  prepararCarpeta,
  queSeBorra,
  reconectarDriveEnSilencio,
  sePuedeUsarDrive,
  seVeDentro,
  tipoDeFichero,
  IconoDeFichero,
  FalloDeArchivo,
  type Destino,
  type Explicacion,
  type Remoto,
} from '@/lib/archivo';
import {
  ASIGNATURAS,
  HORARIO,
  aFecha,
  buscarAsignatura,
  deFecha,
  hhmm,
  type Apunte,
  type Carpeta,
  type ClaveAsignatura,
} from '@/lib/data';

const DIAS_CORTOS = ['L', 'M', 'X', 'J', 'V'] as const;

/** Lo que dura la subida más corta que se puede ver. Sin esto, la barra parpadea. */
const MINIMO_VISIBLE = 420;

export function Asignatura({ clave }: { clave: ClaveAsignatura }) {
  const asig = ASIGNATURAS[clave];
  const ahora = useAhora();
  const apuntes = useApuntes(clave);

  return (
    <mo.section className="vista on asig" variants={ORQUESTA} aria-label={asig.nombre}>
      <Portada clave={clave} ahora={ahora} nApuntes={apuntes.length} />
      <LoQueViene clave={clave} ahora={ahora} />
      <Apuntes clave={clave} apuntes={apuntes} />
    </mo.section>
  );
}

/* ───────────────────────── la portada ───────────────────────── */

/**
 * El nombre, los datos y la semana.
 *
 * La semana no es decoración: son las clases reales de esta asignatura, sacadas del mismo
 * `HORARIO` que pinta la pantalla de horario. Dibujada como una sección —una línea por
 * día, y sobre ella el bloque de clase a la altura que le toca— dice de un vistazo dos
 * cosas que una lista de horas no dice: cuántos días toca y si son mañanas o tardes.
 */
function Portada({ clave, ahora, nApuntes }: { clave: ClaveAsignatura; ahora: Date | null; nApuntes: number }) {
  const asig = ASIGNATURAS[clave];
  const clases = useMemo(() => HORARIO.filter((c) => c.asignatura === clave), [clave]);
  const horas = clases.reduce((s, c) => s + (c.fin - c.ini), 0) / 60;

  /* La franja que se dibuja sale de las clases de ESTA asignatura, no del curso entero:
     si solo hay clase de 9 a 11, el dibujo va de 9 a 11 y no de 8 a 21 con un bloque
     diminuto perdido en medio. */
  const desde = clases.length ? Math.min(...clases.map((c) => c.ini)) : 0;
  const hasta = clases.length ? Math.max(...clases.map((c) => c.fin)) : 0;
  const alto = Math.max(1, hasta - desde);

  /* El día de hoy solo se marca cuando se sabe qué día es. */
  const diaHoy = ahora ? ((ahora.getDay() + 6) % 7) + 1 : 0;

  return (
    <mo.header className="asig-portada" variants={PIEZA} style={{ ['--tc' as string]: `var(--c-${asig.color})` }}>
      <VolverAlHorario />
      <div className="asig-titulo">
        <h1>{asig.nombre}</h1>
        <p className="asig-datos">
          <span className="asig-codigo">{asig.codigo}</span>
          <i aria-hidden="true" />
          <span>
            <b>{horas}</b> h a la semana
          </span>
          <i aria-hidden="true" />
          <span>
            <b>{nApuntes}</b> {nApuntes === 1 ? 'apunte' : 'apuntes'}
          </span>
        </p>
      </div>

      {clases.length > 0 && (
        <div className="asig-semana" aria-label="Cuándo hay clase">
          {DIAS_CORTOS.map((letra, i) => {
            const dia = i + 1;
            const suyas = clases.filter((c) => c.dia === dia);
            return (
              <div className={`asig-dia${dia === diaHoy ? ' hoy' : ''}${suyas.length ? ' tiene' : ''}`} key={letra}>
                <span className="asig-pista" aria-hidden="true">
                  {suyas.map((c) => (
                    <span
                      className="asig-bloque"
                      key={c.ini}
                      style={{
                        top: `${((c.ini - desde) / alto) * 100}%`,
                        height: `${((c.fin - c.ini) / alto) * 100}%`,
                      }}
                      title={`${hhmm(c.ini)} – ${hhmm(c.fin)}`}
                    />
                  ))}
                </span>
                <span className="asig-letra">{letra}</span>
                {/* La hora solo donde hay clase: repetirla vacía llena la fila de guiones */}
                <span className="asig-hora">{suyas.length ? hhmm(suyas[0].ini) : ''}</span>
              </div>
            );
          })}
        </div>
      )}
    </mo.header>
  );
}

/* ───────────────────────── lo que viene ───────────────────────── */

function LoQueViene({ clave, ahora }: { clave: ClaveAsignatura; ahora: Date | null }) {
  const eventos = useEventos();
  const asig = ASIGNATURAS[clave];

  /**
   * Los eventos de esta asignatura, de hoy en adelante.
   *
   * El campo `materia` se escribe a mano, así que se compara con `buscarAsignatura`, que
   * tolera el nombre, el corto, el código y las tildes. Comparar cadenas a pelo dejaría
   * fuera «Geometria» por no llevar tilde, y eso se lee como que la aplicación pierde
   * cosas.
   *
   * Sin reloj no hay «de hoy en adelante», así que hasta que monta no se enseña ninguno.
   * Es lo correcto: la aplicación se prerrenderiza y el servidor no sabe qué día es donde
   * está Celeste.
   */
  const proximos = useMemo(() => {
    if (!ahora) return [];
    const hoyClave = aFecha(ahora);
    return eventos
      .filter((e) => e.fecha >= hoyClave && buscarAsignatura(e.materia)?.codigo === asig.codigo)
      .slice(0, 4);
  }, [eventos, ahora, asig.codigo]);

  if (proximos.length === 0) return null;

  return (
    <mo.div className="asig-viene" variants={PIEZA}>
      {proximos.map((e) => {
        const dias = ahora
          ? Math.round((deFecha(e.fecha).getTime() - new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime()) / 86_400_000)
          : 0;
        return (
          <span className="asig-ev" key={e.id} style={{ ['--tc' as string]: `var(--c-${TIPOS[e.tipo].color})` }}>
            <span className="asig-ev-ico">
              <Icono nombre={TIPOS[e.tipo].icono} tam={14} />
            </span>
            <span className="asig-ev-txt">
              <b>{e.titulo}</b>
              <small>{TIPOS[e.tipo].n}</small>
            </span>
            <span className="asig-ev-cuando">{dias <= 0 ? 'hoy' : dias === 1 ? 'mañana' : `${dias} días`}</span>
          </span>
        );
      })}
    </mo.div>
  );
}

/* ───────────────────────── los apuntes ───────────────────────── */

/**
 * El sitio de trabajo: carpetas y apuntes de una asignatura.
 *
 * **Todo esto vive en Drive.** Subir, crear carpetas, renombrar y mover escriben en el
 * Drive de quien lo haya conectado, porque una carpeta de Archicel es una carpeta de verdad
 * allí. Sin Drive conectado la pantalla no ofrece organizar: ofrece conectar. Lo antiguo
 * que se guardó en el navegador se sigue pudiendo abrir, renombrar, mover y borrar.
 *
 * El árbol lo arma esta pantalla a partir de una lista plana de carpetas, cada una con su
 * `madre`. No se guarda ninguna ruta de texto, y eso es lo que hace que renombrar una
 * carpeta no obligue a reescribir nada de lo que hay dentro.
 */

interface Subiendo {
  /** Por subida, no por nombre: dos `foto.jpg` en la misma tanda son dos barras. */
  id: string;
  nombre: string;
  tanto: number;
}

/** A dónde iba una subida, fijado al empezar: reintentar va ahí, no a donde se esté ahora. */
interface Donde {
  carpeta: string | null;
  destino: Destino;
}

type Objetivo = { tipo: 'apunte'; a: Apunte } | { tipo: 'carpeta'; c: Carpeta };

/**
 * Lo que no salió bien, con todo lo necesario para reintentarlo sin pedir nada otra vez.
 *
 *   · `subida`: no llegó a Drive. Guarda el `File`, y reintentar sigue donde se quedó.
 *   · `ficha`: **sí** llegó a Drive, pero el almacén no la aceptó. Reintentar solo vuelve a
 *     apuntarla; subirla otra vez dejaría dos copias en Drive.
 *   · `borrado`: Drive no confirmó la papelera, así que la ficha sigue ahí.
 */
type Problema = { id: string; nombre: string; ex: Explicacion } & (
  | { tipo: 'subida'; fichero: File; donde: Donde }
  | { tipo: 'ficha'; fichero: File; remoto: Remoto; donde: Donde }
  | { tipo: 'borrado'; objetivo: Objetivo }
);

/** Lo que se está arrastrando dentro de la aplicación, para no confundirlo con el disco. */
const TIPO_ARRASTRE = 'application/x-archicel';

/** Tope de profundidad al dibujar el camino: un ciclo no puede colgar la pantalla. */
const HONDO = 24;

/**
 * Cuántos ficheros suben a la vez. Uno a uno, veinte fotos de pizarra esperan cada una a la
 * anterior aunque la conexión dé para más; todos a la vez, Drive empieza a contestar que
 * vaya más despacio. Tres es lo que recomienda su guía para un solo usuario.
 */
const A_LA_VEZ = 3;

let serie = 0;
const nuevaClave = () => `p${++serie}`;

/** Hace `hacer` sobre la lista, `cuantos` a la vez. */
async function enParalelo<T>(lista: T[], cuantos: number, hacer: (x: T) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(cuantos, lista.length) }, async () => {
      while (i < lista.length) await hacer(lista[i++]);
    }),
  );
}

/**
 * El nombre de la ficha, dentro del tope de las reglas (300).
 *
 * Un nombre más largo lo rechazaba el almacén **después** de haber subido el fichero, y la
 * tira decía que no había llegado a Drive cuando sí. Se acorta por el medio y se conserva
 * la extensión; en Drive el fichero se queda con su nombre entero.
 */
function acortar(nombre: string, tope = 300): string {
  if (nombre.length <= tope) return nombre;
  const i = nombre.lastIndexOf('.');
  const ext = i > 0 && nombre.length - i <= 16 ? nombre.slice(i) : '';
  return `${nombre.slice(0, tope - ext.length - 1)}…${ext}`;
}

function Apuntes({ clave, apuntes }: { clave: ClaveAsignatura; apuntes: Apunte[] }) {
  const { almacen } = useArchicel();
  const { avisar } = useUI();
  const archivador = useMemo(() => elArchivador(), []);
  const carpetas = useCarpetas(clave);
  const entrada = useRef<HTMLInputElement>(null);

  const [aqui, setAqui] = useState<string | null>(null);
  const [encima, setEncima] = useState(false);
  const [subiendo, setSubiendo] = useState<Subiendo[]>([]);
  const [problemas, setProblemas] = useState<Problema[]>([]);
  const [abierto, setAbierto] = useState<Apunte | null>(null);
  const [creando, setCreando] = useState(false);
  const [renombrando, setRenombrando] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<Objetivo | null>(null);
  /** Lo que se está mandando a la papelera ahora mismo: se apaga hasta que Drive conteste. */
  const [yendo, setYendo] = useState<ReadonlySet<string>>(new Set());
  /** Sobre qué carpeta se está soltando algo, para marcarla. */
  const [sobre, setSobre] = useState<string | null>(null);

  const [enDrive, setEnDrive] = useState(false);
  const [correo, setCorreo] = useState<string | null>(null);
  const [conectando, setConectando] = useState(false);

  /*
   * Al llegar, y cada vez que Drive se conecta o se desconecta —aquí, desde los ajustes o
   * en otra pestaña—: de quién es el Drive y, sin crear nada, dónde está la carpeta de esta
   * asignatura. Lo segundo es lo que hace que la primera subida no espere a buscarla.
   *
   * Sin escuchar el cambio, desconectar desde los ajustes dejaba esta página diciendo «En
   * el Drive de …» y ofreciendo subir con un permiso que ya no existe.
   */
  useEffect(() => {
    const mirar = () => {
      const listo = driveConectado();
      setEnDrive(listo);
      if (listo) {
        void deQuienEsElDrive().then(setCorreo);
        prepararCarpeta(clave);
      } else {
        setCorreo(null);
      }
    };
    void reconectarDriveEnSilencio().then(mirar);
    return alCambiarDrive(mirar);
  }, [clave]);

  const yaConectado = useCallback(() => {
    setEnDrive(true);
    void deQuienEsElDrive().then(setCorreo);
  }, []);

  const conectar = useCallback(async () => {
    setConectando(true);
    try {
      await archivador.conectar();
      yaConectado();
      prepararCarpeta(clave);
      avisar('Drive conectado');
    } catch (e) {
      avisar(explicar(e).motivo);
    } finally {
      setConectando(false);
    }
  }, [archivador, avisar, clave, yaConectado]);

  /* ── el árbol ── */

  const porId = useMemo(() => new Map(carpetas.map((c) => [c.id, c])), [carpetas]);

  /**
   * El camino desde la raíz hasta donde se está.
   *
   * Sube por `madre` y **cuenta los pasos**: si alguien acabara siendo su propia abuela
   * —un dato corrupto, una escritura a medias desde otro dispositivo— esto giraría para
   * siempre y se llevaría la pestaña por delante. Un tope convierte un dato malo en una
   * miga de pan rara, que es un problema infinitamente menor.
   */
  const camino = useMemo(() => {
    const trozos: Carpeta[] = [];
    const vistas = new Set<string>();
    let id = aqui;
    for (let i = 0; id && i < HONDO; i++) {
      if (vistas.has(id)) break;
      vistas.add(id);
      const c = porId.get(id);
      if (!c) break;
      trozos.unshift(c);
      id = c.madre ?? null;
    }
    return trozos;
  }, [aqui, porId]);

  /* Si la carpeta en la que estaba desaparece —la borró otro dispositivo— se vuelve a la
     raíz en vez de quedarse enseñando el vacío de un sitio que ya no existe. */
  useEffect(() => {
    if (aqui && !porId.has(aqui)) setAqui(null);
  }, [aqui, porId]);

  const hijas = useMemo(() => carpetas.filter((c) => (c.madre ?? null) === aqui), [carpetas, aqui]);
  const suyos = useMemo(() => apuntes.filter((a) => (a.carpeta ?? null) === aqui), [apuntes, aqui]);
  const carpetaActual = aqui ? porId.get(aqui) : undefined;
  const destino = useMemo<Destino>(
    () => ({ asignatura: clave, padre: carpetaActual?.remoto }),
    [clave, carpetaActual],
  );

  const quejarse = useCallback((nuevos: Problema[]) => {
    if (nuevos.length) setProblemas((p) => [...p, ...nuevos]);
  }, []);

  /* ── subir ── */

  const cuenta = useRef(0);

  const apuntar = useCallback(
    (fichero: File, remoto: Remoto, carpeta: string | null) =>
      almacen.apuntes.guardar({
        asignatura: clave,
        nombre: acortar(fichero.name),
        tipo: (fichero.type || '').slice(0, 120),
        tam: fichero.size,
        remoto,
        ...(carpeta ? { carpeta } : {}),
        creado: Date.now(),
      }),
    [almacen, clave],
  );

  const noApuntado = (e: unknown): Explicacion => ({
    motivo: 'Está en tu Drive, pero Archicel no pudo apuntarlo.',
    arreglo: 'Pulsa «Reintentar»: solo se vuelve a apuntar, no se sube otra vez.',
    reconectar: false,
    ...(e instanceof Error && e.message ? { dijo: e.message } : {}),
  });

  const subir = useCallback(
    async (ficheros: FileList | File[], donde: Donde = { carpeta: aqui, destino }) => {
      const lote = [...ficheros].map((f) => ({ id: nuevaClave(), f }));
      if (lote.length === 0) return;

      setSubiendo((s) => [...s, ...lote.map(({ id, f }) => ({ id, nombre: f.name, tanto: 0 }))]);
      const arranque = Date.now();
      let bien = 0;
      const malos: Problema[] = [];

      await enParalelo(lote, A_LA_VEZ, async ({ id, f }) => {
        let remoto: Remoto;
        try {
          remoto = await archivador.subir(f, donde.destino, (tanto) =>
            setSubiendo((s) => s.map((x) => (x.id === id ? { ...x, tanto } : x))),
          );
        } catch (e) {
          const ex = explicar(e);
          /* Si lo que falta es la carpeta, se dice cuál: «la carpeta de destino» obliga a
             adivinar a cuál se refiere. */
          const nombre = donde.carpeta ? porId.get(donde.carpeta)?.nombre : undefined;
          if (e instanceof FalloDeArchivo && e.causa === 'sin-carpeta' && nombre) {
            ex.motivo = `La carpeta «${nombre}» ya no está en tu Drive.`;
          }
          malos.push({ id, nombre: f.name, tipo: 'subida', fichero: f, donde, ex });
          console.error('[archicel] subida fallida', f.name, e);
          return;
        }
        try {
          await apuntar(f, remoto, donde.carpeta);
          bien++;
        } catch (e) {
          malos.push({ id, nombre: f.name, tipo: 'ficha', fichero: f, remoto, donde, ex: noApuntado(e) });
          console.error('[archicel] ficha rechazada tras subir', f.name, e);
        }
      });

      if (bien > 0 && !enDrive) yaConectado();
      const falta = MINIMO_VISIBLE - (Date.now() - arranque);
      if (falta > 0) await new Promise((r) => setTimeout(r, falta));
      const suyas = new Set(lote.map((x) => x.id));
      setSubiendo((s) => s.filter((x) => !suyas.has(x.id)));
      quejarse(malos);
      if (bien > 0) avisar(bien === 1 ? 'Apunte guardado' : `${bien} apuntes guardados`);
    },
    [archivador, apuntar, avisar, destino, aqui, enDrive, yaConectado, quejarse, porId],
  );

  /* ── organizar ── */

  const crearCarpeta = useCallback(
    async (nombre: string) => {
      const limpio = nombre.trim();
      setCreando(false);
      if (!limpio) return;
      try {
        const remoto = await archivador.crearCarpeta(limpio, destino);
        await almacen.carpetas.guardar({
          asignatura: clave,
          nombre: limpio,
          remoto,
          ...(aqui ? { madre: aqui } : {}),
          creado: Date.now(),
        });
        avisar('Carpeta creada');
      } catch (e) {
        avisar(explicar(e).motivo);
      }
    },
    [archivador, almacen, clave, destino, aqui, avisar],
  );

  const renombrar = useCallback(
    async (que: Apunte | Carpeta, nombre: string) => {
      const limpio = nombre.trim();
      setRenombrando(null);
      if (!limpio || limpio === que.nombre) return;
      try {
        /* Primero el proveedor y después la ficha: al revés, un fallo dejaría la pantalla
           diciendo un nombre que en Drive es otro, que es la peor de las dos mentiras. */
        await archivador.renombrar(que.remoto, limpio);
        const esCarpeta = !('tipo' in que);
        if (esCarpeta) await almacen.carpetas.guardar({ ...(que as Carpeta), nombre: limpio });
        else await almacen.apuntes.guardar({ ...(que as Apunte), nombre: limpio });
      } catch (e) {
        avisar(explicar(e).motivo);
      }
    },
    [archivador, almacen, avisar],
  );

  /**
   * Mueve un apunte o una carpeta a otra carpeta. `hasta` en `null` es la raíz.
   *
   * Lo único delicado es mover una carpeta dentro de sí misma o de una hija suya, que
   * dejaría un trozo del árbol flotando sin camino a la raíz: invisible y sin forma de
   * recuperarlo. Se comprueba antes y se dice que no.
   */
  const mover = useCallback(
    async (id: string, esCarpeta: boolean, hasta: string | null) => {
      if (esCarpeta && id === hasta) return;

      if (esCarpeta && hasta) {
        for (let p: string | null = hasta, i = 0; p && i < HONDO; i++) {
          if (p === id) {
            avisar('Una carpeta no puede ir dentro de sí misma');
            return;
          }
          p = porId.get(p)?.madre ?? null;
        }
      }

      const que = esCarpeta ? porId.get(id) : apuntes.find((a) => a.id === id);
      if (!que) return;
      const dondeEsta = esCarpeta ? ((que as Carpeta).madre ?? null) : ((que as Apunte).carpeta ?? null);
      if (dondeEsta === hasta) return;

      try {
        await archivador.mover(
          que.remoto,
          dondeEsta ? (porId.get(dondeEsta)?.remoto ?? null) : null,
          hasta ? (porId.get(hasta)?.remoto ?? null) : null,
          { asignatura: clave },
        );
        if (esCarpeta) {
          const c = { ...(que as Carpeta) };
          if (hasta) c.madre = hasta;
          else delete c.madre;
          await almacen.carpetas.guardar(c);
        } else {
          const a = { ...(que as Apunte) };
          if (hasta) a.carpeta = hasta;
          else delete a.carpeta;
          await almacen.apuntes.guardar(a);
        }
      } catch (e) {
        avisar(explicar(e).motivo);
      }
    },
    [archivador, almacen, apuntes, porId, clave, avisar],
  );

  /* ── borrar ── */

  const marcar = useCallback((ids: string[], si: boolean) => {
    setYendo((s) => {
      const n = new Set(s);
      for (const id of ids) {
        if (si) n.add(id);
        else n.delete(id);
      }
      return n;
    });
  }, []);

  /**
   * Un apunte a la papelera. **La ficha solo se borra cuando Drive lo ha confirmado.**
   *
   * Antes se tragaba cualquier fallo y borraba la ficha igual: con Drive devolviendo 503,
   * el apunte desaparecía de Archicel y seguía vivo en Drive sin nada que lo enlazara. Si
   * Drive dice que ya no estaba, eso sí es confirmación, y el archivador lo da por hecho.
   */
  const borrarApunte = useCallback(
    async (a: Apunte) => {
      marcar([a.id], true);
      try {
        await archivador.borrar(a.remoto);
        await almacen.apuntes.borrar(a.id);
        avisar(a.remoto.proveedor === 'drive' ? 'En la papelera de Drive' : 'Apunte eliminado');
      } catch (e) {
        quejarse([{ id: nuevaClave(), nombre: a.nombre, tipo: 'borrado', objetivo: { tipo: 'apunte', a }, ex: explicar(e) }]);
        console.error('[archicel] borrado fallido', a.nombre, e);
      } finally {
        marcar([a.id], false);
      }
    },
    [archivador, almacen, avisar, marcar, quejarse],
  );

  /**
   * Una carpeta a la papelera, con todo lo de dentro, **después de una sola pregunta**.
   *
   * Drive se lleva el árbol entero con la carpeta de arriba, así que casi siempre es una
   * llamada. Lo que falle se queda —su ficha, lo que cuelga de ella y el camino hasta
   * arriba— y la tira dice por qué. El detalle está en `arbol.ts`.
   */
  const borrarCarpeta = useCallback(
    async (c: Carpeta) => {
      const plan = planDeBorrado(c, carpetas, apuntes);
      const todos = [...plan.arbol.carpetas.map((x) => x.id), ...plan.arbol.apuntes.map((x) => x.id)];
      marcar(todos, true);
      const fallidos = new Set<string>();
      let primero: unknown = null;
      const intentar = async (id: string, remoto: Remoto) => {
        try {
          await archivador.borrar(remoto);
        } catch (e) {
          fallidos.add(id);
          primero ??= e;
          console.error('[archicel] borrado fallido', id, e);
        }
      };
      try {
        await enParalelo(plan.raices, 4, (p) => (p.tipo === 'carpeta' ? intentar(p.c.id, p.c.remoto) : intentar(p.a.id, p.a.remoto)));
        await enParalelo(plan.locales, 4, (a) => intentar(a.id, a.remoto));
        const fuera = queSeBorra(plan, fallidos);
        await Promise.all([
          ...fuera.apuntes.map((a) => almacen.apuntes.borrar(a.id)),
          ...fuera.carpetas.map((x) => almacen.carpetas.borrar(x.id)),
        ]);
      } catch (e) {
        fallidos.add(c.id);
        primero ??= e;
      } finally {
        marcar(todos, false);
      }
      if (fallidos.size > 0) {
        quejarse([{ id: nuevaClave(), nombre: c.nombre, tipo: 'borrado', objetivo: { tipo: 'carpeta', c }, ex: explicar(primero) }]);
      } else {
        avisar(c.remoto.proveedor === 'drive' ? 'Carpeta en la papelera de Drive' : 'Carpeta eliminada');
      }
    },
    [carpetas, apuntes, archivador, almacen, avisar, marcar, quejarse],
  );

  const borrar = useCallback(
    (o: Objetivo) => (o.tipo === 'apunte' ? borrarApunte(o.a) : borrarCarpeta(o.c)),
    [borrarApunte, borrarCarpeta],
  );

  /* ── reintentar ── */

  const reintentar = useCallback(async () => {
    const lista = problemas;
    if (lista.length === 0) return;
    if (lista.some((p) => p.ex.reconectar)) {
      setConectando(true);
      try {
        await archivador.conectar();
        yaConectado();
      } catch (e) {
        avisar(explicar(e).motivo);
        return;
      } finally {
        setConectando(false);
      }
    }
    setProblemas([]);

    /* Si la carpeta de destino ya no existe en Archicel, a la raíz: apuntar dentro de una
       carpeta borrada dejaría el apunte invisible. */
    const vigente = (d: Donde): Donde =>
      d.carpeta && !porId.has(d.carpeta) ? { carpeta: null, destino: { asignatura: clave } } : d;

    const grupos = new Map<Donde, File[]>();
    for (const p of lista) if (p.tipo === 'subida') grupos.set(p.donde, [...(grupos.get(p.donde) ?? []), p.fichero]);

    await Promise.all([
      ...[...grupos].map(([d, fs]) => subir(fs, vigente(d))),
      ...lista.map(async (p) => {
        if (p.tipo === 'ficha') {
          try {
            await apuntar(p.fichero, p.remoto, vigente(p.donde).carpeta);
            avisar('Apunte guardado');
          } catch (e) {
            quejarse([{ ...p, id: nuevaClave(), ex: noApuntado(e) }]);
          }
        }
        if (p.tipo === 'borrado') {
          const o = p.objetivo;
          const sigue = o.tipo === 'apunte' ? apuntes.some((a) => a.id === o.a.id) : porId.has(o.c.id);
          if (sigue) await borrar(o);
        }
      }),
    ]);
  }, [problemas, archivador, yaConectado, avisar, porId, clave, subir, apuntar, quejarse, apuntes, borrar]);

  const vacio = hijas.length === 0 && suyos.length === 0 && subiendo.length === 0 && problemas.length === 0 && !creando;

  return (
    <mo.div
      className={`asig-apuntes${encima ? ' encima' : ''}`}
      variants={PIEZA}
      onDragEnter={(e) => {
        /* Solo el disco resalta el panel entero: un arrastre de dentro se suelta sobre una
           carpeta concreta, y marcar las dos cosas a la vez no dice dónde va a caer. Sin
           Drive no hay dónde soltarlo, así que tampoco se invita a hacerlo. */
        if (!e.dataTransfer.types.includes('Files') || !enDrive) return;
        e.preventDefault();
        cuenta.current++;
        setEncima(true);
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files') && enDrive) e.preventDefault();
      }}
      onDragLeave={() => {
        cuenta.current = Math.max(0, cuenta.current - 1);
        if (cuenta.current === 0) setEncima(false);
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        cuenta.current = 0;
        setEncima(false);
        if (enDrive) void subir(e.dataTransfer.files);
      }}
    >
      <div className="asig-cab">
        <Camino
          camino={camino}
          alIr={setAqui}
          alSoltar={(id, esCarpeta, hasta) => void mover(id, esCarpeta, hasta)}
          sobre={sobre}
          setSobre={setSobre}
        />
        <span className={`asig-donde${enDrive ? '' : ' flojo'}`} title={correo ?? undefined}>
          {enDrive ? (correo ? `En el Drive de ${correo}` : 'En tu Drive') : 'Sin conectar'}
        </span>

        {/* Sin Drive no hay dónde guardar, así que conectar **es** la acción sólida de la
            pantalla y las otras dos se apartan. Ofrecer «Subir» sabiendo que va a fallar es
            hacer perder el tiempo a quien lo pulse. */}
        {!enDrive && sePuedeUsarDrive() && (
          <Button type="button" onClick={() => void conectar()} disabled={conectando}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3.6 20.2 8v8L12 20.4 3.8 16V8Z" />
              <path d="M3.8 8 12 12.4 20.2 8M12 12.4v8" />
            </svg>
            {conectando ? 'Conectando…' : 'Conectar Drive'}
          </Button>
        )}

        <Button type="button" variant="outline" onClick={() => setCreando(true)} disabled={!enDrive}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h3l2 2.5h6A2.5 2.5 0 0 1 20 10v7a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17Z" />
            <path d="M12 11.5v5M9.5 14h5" />
          </svg>
          Carpeta
        </Button>

        <Button type="button" variant={enDrive ? 'default' : 'outline'} onClick={() => entrada.current?.click()} disabled={!enDrive}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 20V7" />
            <path d="m7.5 11.5 4.5-4.5 4.5 4.5" />
            <path d="M4 4.5h16" />
          </svg>
          Subir
        </Button>
        <input
          ref={entrada}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void subir(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      <AnimatePresence>
        {subiendo.length > 0 && (
          <mo.div className="asig-subiendo" key="subiendo" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: TIEMPO.roce, ease: CURVA.salida }}>
            {subiendo.map((s) => (
              <span className="asig-barra" key={s.id}>
                <span className="asig-barra-txt">{s.nombre}</span>
                <span className="asig-barra-via" aria-hidden="true">
                  <mo.i animate={{ scaleX: s.tanto || 0.08 }} transition={MUELLE.normal} />
                </span>
              </span>
            ))}
          </mo.div>
        )}
      </AnimatePresence>

      <Tira
        problemas={problemas}
        conectando={conectando}
        alReintentar={() => void reintentar()}
        alDescartar={() => setProblemas([])}
      />

      {vacio ? (
        <div className="asig-vacio">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h3l2 2.5h6A2.5 2.5 0 0 1 20 10v7a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17Z" />
          </svg>
          <p>
            {!enDrive
              ? 'Conecta tu Drive y los apuntes se guardarán ahí, no en este ordenador.'
              : aqui
                ? 'Esta carpeta está vacía. Arrastra aquí lo que vaya dentro.'
                : 'Arrastra aquí tus fotos de pizarra, los PDF de teoría o lo que te manden.'}
          </p>
        </div>
      ) : (
        <ul className="asig-lista">
          <AnimatePresence initial={false}>
            {creando && (
              <mo.li className="asig-fila nueva" key="nueva" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: TIEMPO.roce, ease: CURVA.salida }}>
                <span className="asig-ico carp" aria-hidden="true">
                  <IconoCarpeta />
                </span>
                <Bautizo inicial="" alTerminar={(n) => void crearCarpeta(n)} alCancelar={() => setCreando(false)} />
              </mo.li>
            )}

            {hijas.map((c) => (
              <FilaCarpeta
                key={c.id}
                carpeta={c}
                editando={renombrando === c.id}
                marcada={sobre === c.id}
                yendo={yendo.has(c.id)}
                alEntrar={() => setAqui(c.id)}
                alRenombrar={() => setRenombrando(c.id)}
                alBautizar={(n) => void renombrar(c, n)}
                alCancelar={() => setRenombrando(null)}
                alBorrar={() => setConfirmando({ tipo: 'carpeta', c })}
                alSoltar={(id, esC) => void mover(id, esC, c.id)}
                setSobre={setSobre}
              />
            ))}

            {suyos.map((a) => (
              <Fila
                key={a.id}
                apunte={a}
                editando={renombrando === a.id}
                yendo={yendo.has(a.id)}
                alAbrir={() => setAbierto(a)}
                alRenombrar={() => setRenombrando(a.id)}
                alBautizar={(n) => void renombrar(a, n)}
                alCancelar={() => setRenombrando(null)}
                alBorrar={() => setConfirmando({ tipo: 'apunte', a })}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}

      <AnimatePresence>
        {encima && (
          <mo.span className="asig-suelta" key="suelta" variants={VELO} initial="fuera" animate="dentro" exit="saliendo" aria-hidden="true">
            {carpetaActual ? `Suéltalo en «${carpetaActual.nombre}»` : 'Suéltalo aquí'}
          </mo.span>
        )}
      </AnimatePresence>

      <Confirmacion
        objetivo={confirmando}
        carpetas={carpetas}
        apuntes={apuntes}
        cerrar={() => setConfirmando(null)}
        alConfirmar={(o) => {
          setConfirmando(null);
          void borrar(o);
        }}
      />
      <Visor apunte={abierto} cerrar={() => setAbierto(null)} />
    </mo.div>
  );
}

/* ───────────────────────── lo que no salió bien ───────────────────────── */

function titular(ps: Problema[]): string {
  const n = ps.length;
  if (ps.every((p) => p.tipo === 'subida')) return n === 1 ? '1 apunte no llegó a Drive' : `${n} apuntes no llegaron a Drive`;
  if (ps.every((p) => p.tipo === 'ficha')) {
    return n === 1 ? '1 apunte está en Drive pero no en Archicel' : `${n} apuntes están en Drive pero no en Archicel`;
  }
  if (ps.every((p) => p.tipo === 'borrado')) return n === 1 ? `No se pudo eliminar «${ps[0].nombre}»` : `${n} cosas no se pudieron eliminar`;
  return `${n} cosas no salieron bien`;
}

/**
 * La tira de fallos: qué, por qué, **lo que dijo Drive** y cómo se arregla.
 *
 * Un aviso que se va en tres segundos es el peor sitio posible para un fallo: de cinco
 * ficheros arrastrados no dice cuál falló, ni por qué, ni deja repetirlo. Esto se queda
 * hasta que se reintenta o se descarta, y reintentar no pide volver a buscar nada.
 */
function Tira({
  problemas,
  conectando,
  alReintentar,
  alDescartar,
}: {
  problemas: Problema[];
  conectando: boolean;
  alReintentar: () => void;
  alDescartar: () => void;
}) {
  const reconectar = problemas.some((p) => p.ex.reconectar);
  return (
    <AnimatePresence>
      {problemas.length > 0 && (
        <mo.div
          className="asig-fallos"
          key="fallos"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: TIEMPO.roce, ease: CURVA.salida }}
          role="status"
        >
          <div className="asig-fallos-cab">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 8v5" />
              <path d="M12 16.5v.01" />
              <path d="M10.3 4.3 2.8 17.2A1.6 1.6 0 0 0 4.2 19.6h15.6a1.6 1.6 0 0 0 1.4-2.4L13.7 4.3a1.6 1.6 0 0 0-2.8 0Z" />
            </svg>
            <span title={titular(problemas)}>{titular(problemas)}</span>
            <Button type="button" variant="outline" size="sm" onClick={alReintentar} disabled={conectando}>
              {conectando ? 'Reconectando…' : reconectar ? 'Reconectar y reintentar' : 'Reintentar'}
            </Button>
            <button type="button" className="asig-fallos-x" onClick={alDescartar} aria-label="Descartar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <ul>
            {problemas.map((p) => (
              <li key={p.id}>
                <b title={p.nombre}>{p.nombre}</b>
                <span>{p.ex.motivo}</span>
                {p.ex.dijo && (
                  <small title={p.ex.dijo}>
                    <em>Drive:</em> {p.ex.dijo}
                  </small>
                )}
                <i>{p.ex.arreglo}</i>
              </li>
            ))}
          </ul>
        </mo.div>
      )}
    </AnimatePresence>
  );
}

/* ───────────────────────── la pregunta antes de borrar ───────────────────────── */

/**
 * Se pregunta **siempre** antes de borrar, y se dice a dónde va.
 *
 * «Eliminar» sugiere que desaparece; en Drive va a la papelera, con treinta días para
 * sacarlo. Decirlo convierte un clic nervioso en una decisión tranquila. Y una carpeta con
 * cosas dentro se pregunta **una vez** para todo el árbol, con la cuenta delante: una
 * carpeta cerrada con veinte apuntes se ve igual que una vacía.
 *
 * Va a `body` por un portal: el panel de los apuntes lleva `backdrop-filter`, que convierte
 * al panel en el bloque contenedor de todo lo `fixed` de dentro — el telón y la hoja se
 * quedarían encerrados en él en vez de cubrir la ventana.
 */
function Confirmacion({
  objetivo,
  carpetas,
  apuntes,
  cerrar,
  alConfirmar,
}: {
  objetivo: Objetivo | null;
  carpetas: Carpeta[];
  apuntes: Apunte[];
  cerrar: () => void;
  alConfirmar: (o: Objetivo) => void;
}) {
  return (
    <AlCuerpo>
      <AnimatePresence>
        {objetivo && (
          <Pregunta key="pregunta" objetivo={objetivo} carpetas={carpetas} apuntes={apuntes} cerrar={cerrar} alConfirmar={alConfirmar} />
        )}
      </AnimatePresence>
    </AlCuerpo>
  );
}

function cuantas(n: number, una: string, varias: string) {
  return `${n} ${n === 1 ? una : varias}`;
}

function Pregunta({
  objetivo,
  carpetas,
  apuntes,
  cerrar,
  alConfirmar,
}: {
  objetivo: Objetivo;
  carpetas: Carpeta[];
  apuntes: Apunte[];
  cerrar: () => void;
  alConfirmar: (o: Objetivo) => void;
}) {
  const caja = useDialogo<HTMLElement>(true, cerrar);
  const si = useRef<HTMLButtonElement>(null);
  const no = useRef<HTMLButtonElement>(null);

  const nombre = objetivo.tipo === 'apunte' ? objetivo.a.nombre : objetivo.c.nombre;
  const remoto = objetivo.tipo === 'apunte' ? objetivo.a.remoto : objetivo.c.remoto;
  const enDrive = remoto.proveedor === 'drive';

  let dentro = '';
  if (objetivo.tipo === 'carpeta') {
    const { carpetas: cs, apuntes: as } = arbolDe(objetivo.c, carpetas, apuntes);
    const nc = cs.length - 1;
    const partes = [nc > 0 ? cuantas(nc, 'carpeta', 'carpetas') : '', as.length > 0 ? cuantas(as.length, 'apunte', 'apuntes') : '']
      .filter(Boolean);
    dentro = partes.join(' y ');
  }

  /* El foco va a la acción si se puede deshacer desde la papelera, y a «Cancelar» si no:
     Intro no debería destruir nada sin vuelta atrás. Va después de `useDialogo`, que
     pone el foco en la hoja al montarse. */
  useEffect(() => {
    (enDrive ? si : no).current?.focus({ preventScroll: true });
  }, [enDrive]);

  return (
    <>
      <mo.div className="telon" variants={VELO} initial="fuera" animate="dentro" exit="saliendo" onClick={cerrar} />
      <mo.aside
        ref={caja}
        tabIndex={-1}
        className="hoja confirmar"
        variants={HOJA}
        initial="fuera"
        animate="dentro"
        exit="saliendo"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmar-titulo"
        aria-describedby="confirmar-texto"
      >
        <h3 id="confirmar-titulo">
          {enDrive ? '¿Mover a la papelera?' : '¿Eliminar de este equipo?'}
        </h3>
        <p className="confirmar-que" title={nombre}>
          {objetivo.tipo === 'carpeta' && <IconoCarpeta />}
          <span>{nombre}</span>
        </p>
        <p id="confirmar-texto" className="confirmar-texto">
          {objetivo.tipo === 'carpeta' && dentro ? (
            <>
              Se va con todo lo que tiene dentro: <b>{dentro}</b>.{' '}
            </>
          ) : null}
          {enDrive
            ? 'Irá a la papelera de tu Drive, y desde allí se puede recuperar durante 30 días.'
            : 'Se guardó en este ordenador antes de que los apuntes fueran a Drive. Borrarlo no tiene vuelta atrás.'}
        </p>
        <div className="confirmar-pie">
          <Button ref={no} type="button" variant="outline" onClick={cerrar}>
            Cancelar
          </Button>
          <Button ref={si} type="button" variant="destructive" data-confirmar onClick={() => alConfirmar(objetivo)}>
            {enDrive ? 'Mover a la papelera' : 'Eliminar'}
          </Button>
        </div>
      </mo.aside>
    </>
  );
}

/**
 * Lo pinta en `body`, fuera del panel.
 *
 * Solo después de montar: la página se prerrenderiza y en el servidor no hay `document`.
 */
function AlCuerpo({ children }: { children: React.ReactNode }) {
  const [listo, setListo] = useState(false);
  useEffect(() => setListo(true), []);
  return listo ? createPortal(children, document.body) : null;
}

/* ───────────────────────── el camino ───────────────────────── */

/**
 * Las migas de pan, y además una diana.
 *
 * Cada trozo acepta que le suelten algo encima, que es la única forma cómoda de sacar una
 * cosa de donde está: arrastrarla **hacia arriba**. Sin eso habría que entrar en la
 * carpeta destino y no habría manera de mover nada hacia fuera.
 */
function Camino({
  camino,
  alIr,
  alSoltar,
  sobre,
  setSobre,
}: {
  camino: Carpeta[];
  alIr: (id: string | null) => void;
  alSoltar: (id: string, esCarpeta: boolean, hasta: string | null) => void;
  sobre: string | null;
  setSobre: (id: string | null) => void;
}) {
  const diana = (hasta: string | null) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes(TIPO_ARRASTRE)) return;
      e.preventDefault();
      e.stopPropagation();
      setSobre(hasta ?? 'raiz');
    },
    onDragLeave: () => setSobre(null),
    onDrop: (e: React.DragEvent) => {
      const crudo = e.dataTransfer.getData(TIPO_ARRASTRE);
      if (!crudo) return;
      e.preventDefault();
      e.stopPropagation();
      setSobre(null);
      const [tipo, id] = crudo.split(':');
      alSoltar(id, tipo === 'c', hasta);
    },
  });

  return (
    <nav className="asig-camino" aria-label="Dónde estás">
      <button
        type="button"
        className={`asig-miga${camino.length === 0 ? ' aqui' : ''}${sobre === 'raiz' ? ' diana' : ''}`}
        onClick={() => alIr(null)}
        {...diana(null)}
      >
        Apuntes
      </button>
      {camino.map((c, i) => (
        <span className="asig-miga-par" key={c.id}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m10 6 6 6-6 6" />
          </svg>
          <button
            type="button"
            className={`asig-miga${i === camino.length - 1 ? ' aqui' : ''}${sobre === c.id ? ' diana' : ''}`}
            onClick={() => alIr(c.id)}
            {...diana(c.id)}
          >
            {c.nombre}
          </button>
        </span>
      ))}
    </nav>
  );
}

/* ───────────────────────── las filas ───────────────────────── */

/**
 * Escribir un nombre, para crear y para renombrar.
 *
 * Se selecciona el texto al aparecer: renombrar casi siempre es escribir otra cosa, no
 * añadir al final. `Enter` confirma y `Escape` cancela, que es lo que hace cualquiera sin
 * que nadie se lo diga; y salir del campo también confirma, porque perder lo escrito por
 * haber pulsado fuera es de las cosas que más enfadan.
 */
function Bautizo({
  inicial,
  alTerminar,
  alCancelar,
}: {
  inicial: string;
  alTerminar: (nombre: string) => void;
  alCancelar: () => void;
}) {
  const campo = useRef<HTMLInputElement>(null);
  useEffect(() => {
    campo.current?.focus();
    campo.current?.select();
  }, []);
  return (
    <input
      ref={campo}
      className="asig-bautizo"
      defaultValue={inicial}
      maxLength={200}
      placeholder="Nombre de la carpeta"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') alTerminar(e.currentTarget.value);
        if (e.key === 'Escape') alCancelar();
      }}
      onBlur={(e) => alTerminar(e.currentTarget.value)}
    />
  );
}

function IconoCarpeta() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h3l2 2.5h6A2.5 2.5 0 0 1 20 10v7a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17Z" />
    </svg>
  );
}

function BotonesDeFila({ alRenombrar, alBorrar, que }: { alRenombrar: () => void; alBorrar: () => void; que: string }) {
  return (
    <>
      <button type="button" className="asig-accion" onClick={(e) => { e.stopPropagation(); alRenombrar(); }} aria-label={`Renombrar ${que}`}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h8" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>
      <button type="button" className="asig-quitar" onClick={(e) => { e.stopPropagation(); alBorrar(); }} aria-label={`Eliminar ${que}`}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13h10l1-13" />
        </svg>
      </button>
    </>
  );
}

function FilaCarpeta({
  carpeta,
  editando,
  marcada,
  yendo,
  alEntrar,
  alRenombrar,
  alBautizar,
  alCancelar,
  alBorrar,
  alSoltar,
  setSobre,
}: {
  carpeta: Carpeta;
  editando: boolean;
  marcada: boolean;
  yendo: boolean;
  alEntrar: () => void;
  alRenombrar: () => void;
  alBautizar: (n: string) => void;
  alCancelar: () => void;
  alBorrar: () => void;
  alSoltar: (id: string, esCarpeta: boolean) => void;
  setSobre: (id: string | null) => void;
}) {
  return (
    <mo.li
      className={`asig-fila carp${marcada ? ' diana' : ''}${yendo ? ' yendo' : ''}`}
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: TIEMPO.roce, ease: CURVA.salida }}
      draggable={!editando && !yendo}
      aria-busy={yendo || undefined}
      /* `Capture` porque Motion declara su propio `onDragStart` —el de su gesto de
         arrastre— y tapa el del DOM, que es el que lleva `dataTransfer`. En el elemento
         que origina el arrastre las dos fases son la misma cosa. */
      onDragStartCapture={(e) => e.dataTransfer.setData(TIPO_ARRASTRE, `c:${carpeta.id}`)}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(TIPO_ARRASTRE)) return;
        e.preventDefault();
        e.stopPropagation();
        setSobre(carpeta.id);
      }}
      onDragLeave={() => setSobre(null)}
      onDrop={(e) => {
        const crudo = e.dataTransfer.getData(TIPO_ARRASTRE);
        if (!crudo) return;
        e.preventDefault();
        e.stopPropagation();
        setSobre(null);
        const [tipo, id] = crudo.split(':');
        alSoltar(id, tipo === 'c');
      }}
    >
      {editando ? (
        <>
          <span className="asig-ico carp" aria-hidden="true">
            <IconoCarpeta />
          </span>
          <Bautizo inicial={carpeta.nombre} alTerminar={alBautizar} alCancelar={alCancelar} />
        </>
      ) : (
        <>
          <button type="button" className="asig-abrir" onClick={alEntrar} title={carpeta.nombre} disabled={yendo}>
            <span className="asig-ico carp" aria-hidden="true">
              <IconoCarpeta />
            </span>
            <span className="asig-nombre">{carpeta.nombre}</span>
            <span className="asig-meta">{yendo ? 'A la papelera…' : 'Carpeta'}</span>
          </button>
          <BotonesDeFila alRenombrar={alRenombrar} alBorrar={alBorrar} que={carpeta.nombre} />
        </>
      )}
    </mo.li>
  );
}

function Fila({
  apunte,
  editando,
  yendo,
  alAbrir,
  alRenombrar,
  alBautizar,
  alCancelar,
  alBorrar,
}: {
  apunte: Apunte;
  editando: boolean;
  yendo: boolean;
  alAbrir: () => void;
  alRenombrar: () => void;
  alBautizar: (n: string) => void;
  alCancelar: () => void;
  alBorrar: () => void;
}) {
  const tipo = tipoDeFichero(apunte.tipo, apunte.nombre);
  const enDrive = apunte.remoto.proveedor === 'drive';
  /* Posarse un momento sobre la fila ya empieza a bajarlo: cuando llega el clic, está. */
  const pausa = useRef<ReturnType<typeof setTimeout> | null>(null);
  const posarse = () => {
    if (!enDrive || pausa.current) return;
    pausa.current = setTimeout(() => precargar(apunte.remoto, { tipo: apunte.tipo, tam: apunte.tam }), 120);
  };
  const irse = () => {
    if (pausa.current) clearTimeout(pausa.current);
    pausa.current = null;
  };
  return (
    <mo.li
      className={`asig-fila${yendo ? ' yendo' : ''}`}
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: TIEMPO.roce, ease: CURVA.salida }}
      draggable={!editando && !yendo}
      aria-busy={yendo || undefined}
      onDragStartCapture={(e) => e.dataTransfer.setData(TIPO_ARRASTRE, `a:${apunte.id}`)}
      onPointerEnter={posarse}
      onPointerLeave={irse}
    >
      {editando ? (
        <>
          <span className="asig-ico" style={{ ['--tc' as string]: `var(--c-${tipo.color})` }} aria-hidden="true">
            <IconoDeFichero clase={tipo.clase} />
          </span>
          <Bautizo inicial={apunte.nombre} alTerminar={alBautizar} alCancelar={alCancelar} />
        </>
      ) : (
        <>
          <button type="button" className="asig-abrir" onClick={alAbrir} onFocus={posarse} title={apunte.nombre} disabled={yendo}>
            <span className="asig-ico" style={{ ['--tc' as string]: `var(--c-${tipo.color})` }} aria-hidden="true">
              <IconoDeFichero clase={tipo.clase} />
            </span>
            <span className="asig-nombre">{apunte.nombre}</span>
            <span className="asig-meta">
              {yendo ? 'A la papelera…' : `${tipo.nombre} · ${pesoLegible(apunte.tam)}`}
            </span>
          </button>
          {enDrive && (
            <a
              className="asig-endrive"
              href={`https://drive.google.com/file/d/${apunte.remoto.id}/view`}
              target="_blank"
              rel="noreferrer"
              title="Verlo en tu Drive"
              aria-label={`Ver ${apunte.nombre} en tu Drive`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 4h6v6" />
                <path d="M20 4 11 13" />
                <path d="M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
              </svg>
            </a>
          )}
          <BotonesDeFila alRenombrar={alRenombrar} alBorrar={alBorrar} que={apunte.nombre} />
        </>
      )}
    </mo.li>
  );
}

/* ───────────────────────── el visor ───────────────────────── */

/**
 * Se separa en presencia y contenido por lo mismo que las hojas modales: React no sabe
 * animar antes de desmontar, y `AnimatePresence` solo puede vigilar a un hijo que aparece
 * y desaparece — no a uno montado devolviendo `null`.
 *
 * Y va a `body`, como la pregunta de borrar: dentro del panel, su `backdrop-filter` lo
 * encerraba en el panel y el telón le quedaba por encima, así que cualquier clic dentro
 * del visor lo cerraba.
 */
function Visor({ apunte, cerrar }: { apunte: Apunte | null; cerrar: () => void }) {
  return (
    <AlCuerpo>
      <AnimatePresence>{apunte && <Contenido key="visor" apunte={apunte} cerrar={cerrar} />}</AnimatePresence>
    </AlCuerpo>
  );
}

/**
 * El visor enseña **lo antes posible**, no cuando ha llegado el último byte.
 *
 * Una imagen se pinta con lo que va llegando —un JPEG o un PNG a medias se dibuja de
 * arriba abajo— y el resto enseña cuánto lleva. Un PDF no se puede pintar a medias, pero
 * «Abriendo… 12 de 40 MB» dice que avanza, que es lo que faltaba. Descargar solo se ofrece
 * con el fichero entero: un enlace a medio fichero bajaría un fichero roto.
 */
function Contenido({ apunte, cerrar }: { apunte: Apunte; cerrar: () => void }) {
  const archivador = useMemo(() => elArchivador(), []);
  const [url, setUrl] = useState<string | null>(null);
  const [entero, setEntero] = useState(false);
  const [tanto, setTanto] = useState(0);
  const [fallo, setFallo] = useState<Explicacion | null>(null);
  const clase = seVeDentro(apunte.tipo, apunte.nombre);
  /* Las direcciones `blob:` que se han dado, para soltarlas: la vigente y las parciales. */
  const dadas = useRef<string[]>([]);

  useEffect(() => {
    let vivo = true;
    const dar = (b: Blob) => {
      const u = URL.createObjectURL(b);
      dadas.current.push(u);
      setUrl(u);
    };
    archivador
      .leer(apunte.remoto as Remoto, {
        tipo: apunte.tipo,
        tam: apunte.tam,
        alAvanzar: (parcial, t) => {
          if (!vivo || t >= 1) return;
          setTanto(t);
          if (clase === 'imagen') dar(parcial);
        },
      })
      .then((b) => {
        if (!vivo) return;
        dar(b);
        setTanto(1);
        setEntero(true);
      })
      .catch((e) => {
        if (vivo) setFallo(explicar(e));
      });
    return () => {
      vivo = false;
      for (const u of dadas.current) URL.revokeObjectURL(u);
      dadas.current = [];
    };
  }, [apunte, archivador, clase]);

  /* Una parcial se suelta cuando la siguiente ya se ha pintado, no antes: soltarla antes
     dejaría un hueco en blanco entre las dos. */
  const pintada = useCallback((u: string) => {
    const viejas = dadas.current.filter((x) => x !== u && dadas.current.indexOf(x) < dadas.current.indexOf(u));
    for (const v of viejas) URL.revokeObjectURL(v);
    dadas.current = dadas.current.filter((x) => !viejas.includes(x));
  }, []);

  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => e.key === 'Escape' && cerrar();
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [cerrar]);

  const abriendo = !fallo && (!url || (!entero && clase !== 'imagen'));
  const recibido = pesoLegible(Math.round(apunte.tam * tanto));

  return (
    <>
      <mo.div className="telon" variants={VELO} initial="fuera" animate="dentro" exit="saliendo" onClick={cerrar} />
      <mo.div
        className="visor"
        variants={APARECER}
        initial="fuera"
        animate="dentro"
        exit="saliendo"
        role="dialog"
        aria-modal="true"
        aria-label={apunte.nombre}
      >
        <div className="visor-cab">
          <span className="visor-nombre">{apunte.nombre}</span>
          <span className="visor-meta">{pesoLegible(apunte.tam)}</span>
          {url && entero && (
            <a className="visor-fuera" href={url} download={apunte.nombre} aria-label="Descargar">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 4v11" />
                <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
                <path d="M4 18.5v1h16v-1" />
              </svg>
            </a>
          )}
          <button type="button" className="visor-cerrar" onClick={cerrar} aria-label="Cerrar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        {/* Mientras baja, una línea de progreso bajo la cabecera: mide bytes de verdad. */}
        {!entero && !fallo && (
          <span className="visor-via" aria-hidden="true">
            <mo.i animate={{ scaleX: tanto || 0.04 }} transition={MUELLE.normal} />
          </span>
        )}

        <div className="visor-cuerpo">
          {fallo ? (
            <div className="visor-nada">
              <p>{fallo.motivo}</p>
              {fallo.dijo && <small className="visor-dijo">Drive: {fallo.dijo}</small>}
              <p className="visor-arreglo">{fallo.arreglo}</p>
            </div>
          ) : abriendo ? (
            <p className="visor-aviso" role="status">
              {tanto > 0 ? `Abriendo… ${recibido} de ${pesoLegible(apunte.tam)}` : 'Abriendo…'}
            </p>
          ) : clase === 'imagen' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url ?? undefined} alt={apunte.nombre} onLoad={() => url && pintada(url)} />
          ) : clase === 'video' ? (
            /* Con controles y sin reproducción automática: un vídeo que arranca solo al
               abrirlo asusta más que ayuda, sobre todo con auriculares puestos. */
            <video src={url ?? undefined} controls playsInline />
          ) : clase === 'pdf' ? (
            <iframe src={url ?? undefined} title={apunte.nombre} />
          ) : (
            <div className="visor-nada">
              <p>Este formato no se puede ver aquí dentro.</p>
              <a className="visor-descargar" href={url ?? undefined} download={apunte.nombre}>
                Descargar
              </a>
            </div>
          )}
        </div>
      </mo.div>
    </>
  );
}

/**
 * La vuelta al horario.
 *
 * El dock sigue señalando Horario mientras se está aquí, pero eso dice dónde estás, no
 * cómo volver: pulsarlo lleva al horario igual, sí, pero hay que deducirlo. Una salida
 * explícita no depende de que nadie deduzca nada — la misma razón por la que la agenda
 * del día tiene su botón «Semana».
 */
function VolverAlHorario() {
  return (
    <Link href="/horario" className="asig-volver">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m14 6-6 6 6 6" />
      </svg>
      Horario
    </Link>
  );
}
