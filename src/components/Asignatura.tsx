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
 * Una sola acción sólida en toda la pantalla, y es la que crea algo: subir. Abrir, borrar
 * y volver son contorno o fantasma.
 */

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as mo from 'motion/react-m';
import { AnimatePresence } from 'motion/react';

import { APARECER, ORQUESTA, PIEZA, VELO, MUELLE, CURVA, TIEMPO } from '@/lib/ui/movimiento';
import { Icono, TIPOS } from '@/lib/ui/catalogo';
import { Button } from '@/components/ui/button';
import { useAhora, useApuntes, useCarpetas, useEventos } from '@/hooks/useDatos';
import { useUI } from '@/lib/ui/contexto';
import { useArchicel } from '@/lib/firebase/sesion';
import {
  deQuienEsElDrive,
  driveConectado,
  elArchivador,
  nombreDeTipo,
  pesoLegible,
  reconectarDriveEnSilencio,
  sePuedeUsarDrive,
  seVeDentro,
  tipoDeFichero,
  IconoDeFichero,
  FalloDeArchivo,
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
 * Aquí manda una idea: **organizarse no puede depender de la infraestructura.** Se pueden
 * crear carpetas, renombrar y mover con Drive conectado y sin conectarlo, porque decidir
 * dónde va cada cosa es del estudiante y no del proveedor de almacenamiento.
 *
 * El árbol lo arma esta pantalla a partir de una lista plana de carpetas, cada una con su
 * `madre`. No se guarda ninguna ruta de texto, y eso es lo que hace que renombrar una
 * carpeta no obligue a reescribir nada de lo que hay dentro.
 */

interface Subiendo {
  nombre: string;
  tanto: number;
}

/** Lo que se está arrastrando dentro de la aplicación, para no confundirlo con el disco. */
const TIPO_ARRASTRE = 'application/x-archicel';

/** Tope de profundidad al dibujar el camino: un ciclo no puede colgar la pantalla. */
const HONDO = 24;

function Apuntes({ clave, apuntes }: { clave: ClaveAsignatura; apuntes: Apunte[] }) {
  const { almacen } = useArchicel();
  const { avisar } = useUI();
  const archivador = elArchivador();
  const carpetas = useCarpetas(clave);
  const entrada = useRef<HTMLInputElement>(null);

  const [aqui, setAqui] = useState<string | null>(null);
  const [encima, setEncima] = useState(false);
  const [subiendo, setSubiendo] = useState<Subiendo[]>([]);
  const [abierto, setAbierto] = useState<Apunte | null>(null);
  const [creando, setCreando] = useState(false);
  const [renombrando, setRenombrando] = useState<string | null>(null);
  /** Sobre qué carpeta se está soltando algo, para marcarla. */
  const [sobre, setSobre] = useState<string | null>(null);

  const [enDrive, setEnDrive] = useState(false);
  const [correo, setCorreo] = useState<string | null>(null);
  const [conectando, setConectando] = useState(false);

  useEffect(() => {
    void reconectarDriveEnSilencio().then((s) => {
      const listo = s || driveConectado();
      setEnDrive(listo);
      if (listo) void deQuienEsElDrive().then(setCorreo);
    });
  }, []);

  const conectar = useCallback(async () => {
    setConectando(true);
    try {
      await archivador.conectar();
      setEnDrive(true);
      void deQuienEsElDrive().then(setCorreo);
      avisar('Drive conectado');
    } catch (e) {
      avisar(e instanceof Error && e.message ? e.message : 'No se pudo conectar con Drive');
    } finally {
      setConectando(false);
    }
  }, [archivador, avisar]);

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
    if (aqui && carpetas.length > 0 && !porId.has(aqui)) setAqui(null);
  }, [aqui, porId, carpetas.length]);

  const hijas = useMemo(() => carpetas.filter((c) => (c.madre ?? null) === aqui), [carpetas, aqui]);
  const suyos = useMemo(() => apuntes.filter((a) => (a.carpeta ?? null) === aqui), [apuntes, aqui]);
  const carpetaActual = aqui ? porId.get(aqui) : undefined;
  const destino = useMemo(
    () => ({ asignatura: clave, padre: carpetaActual?.remoto }),
    [clave, carpetaActual],
  );

  /* ── subir ── */

  const cuenta = useRef(0);
  const [fallidos, setFallidos] = useState<Array<{ f: File; motivo: string; arreglo: string; caducada: boolean }>>([]);

  const subir = useCallback(
    async (ficheros: FileList | File[]) => {
      const lista = [...ficheros];
      if (lista.length === 0) return;

      setFallidos([]);
      setSubiendo(lista.map((f) => ({ nombre: f.name, tanto: 0 })));
      const arranque = Date.now();
      let bien = 0;
      const malos: Array<{ f: File; motivo: string; arreglo: string; caducada: boolean }> = [];

      for (const fichero of lista) {
        try {
          const remoto = await archivador.subir(fichero, destino, (tanto) =>
            setSubiendo((s) => s.map((x) => (x.nombre === fichero.name ? { ...x, tanto } : x))),
          );

          if (remoto.proveedor === 'drive' && !enDrive) {
            setEnDrive(true);
            void deQuienEsElDrive().then(setCorreo);
          }

          await almacen.apuntes.guardar({
            asignatura: clave,
            nombre: fichero.name,
            tipo: fichero.type,
            tam: fichero.size,
            remoto,
            ...(aqui ? { carpeta: aqui } : {}),
            creado: Date.now(),
          });
          bien++;
        } catch (e) {
          /*
           * El motivo **y cómo se arregla**, que es la mitad que faltaba.
           *
           * Saber que no queda sitio sin saber que hay que vaciar la papelera de Drive
           * deja a quien lo lee igual de atascada. Cada causa tiene una salida distinta
           * y la pantalla es el único sitio donde cabe decirla.
           */
          const f = e instanceof FalloDeArchivo ? e : null;
          const bloqueada = e instanceof Error && /bloque|ventana/i.test(e.message);
          const caducada = f?.causa === 'sin-permiso' || bloqueada;

          const motivo =
            f?.causa === 'sin-sitio'
              ? 'No queda espacio en tu Drive.'
              : f?.causa === 'demasiado-grande'
                ? 'Es demasiado grande.'
                : f?.causa === 'red'
                  ? 'Se cortó la conexión.'
                  : caducada
                    ? 'La sesión de Drive ha caducado.'
                    : (f?.message ?? (e instanceof Error ? e.message : 'Fallo desconocido.'));

          const arreglo =
            f?.causa === 'sin-sitio'
              ? 'Vacía la papelera de Drive o haz sitio, y reintenta.'
              : f?.causa === 'demasiado-grande'
                ? 'Súbelo a Drive desde el navegador y enlázalo desde ahí.'
                : f?.causa === 'red'
                  ? 'Comprueba la conexión y vuelve a intentarlo.'
                  : caducada
                    ? 'Pulsa «Reconectar y reintentar»: Google pedirá permiso una vez.'
                    : 'Reintenta; si vuelve a fallar, lo de arriba es lo que dice Drive.'
;

          malos.push({ f: fichero, motivo, arreglo, caducada });
          console.error('[archicel] subida fallida', fichero.name, e);
        }
      }

      const falta = MINIMO_VISIBLE - (Date.now() - arranque);
      if (falta > 0) await new Promise((r) => setTimeout(r, falta));
      setSubiendo([]);
      setFallidos(malos);
      if (bien > 0) avisar(bien === 1 ? 'Apunte guardado' : `${bien} apuntes guardados`);
    },
    [archivador, almacen, clave, avisar, destino, aqui, enDrive],
  );

  const reintentar = useCallback(async () => {
    const pendientes = fallidos.map((x) => x.f);
    if (pendientes.length === 0) return;
    if (fallidos.some((x) => x.caducada)) {
      setConectando(true);
      try {
        await archivador.conectar();
        setEnDrive(true);
        void deQuienEsElDrive().then(setCorreo);
      } catch (e) {
        avisar(e instanceof Error && e.message ? e.message : 'No se pudo reconectar');
        return;
      } finally {
        setConectando(false);
      }
    }
    await subir(pendientes);
  }, [fallidos, archivador, avisar, subir]);

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
        avisar(e instanceof Error && e.message ? e.message : 'No se pudo crear la carpeta');
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
        avisar(e instanceof Error && e.message ? e.message : 'No se pudo renombrar');
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
        avisar(e instanceof Error && e.message ? e.message : 'No se pudo mover');
      }
    },
    [archivador, almacen, apuntes, porId, clave, avisar],
  );

  const borrar = useCallback(
    async (a: Apunte) => {
      try {
        await archivador.borrar(a.remoto as Remoto);
      } catch {
        /* Si el byte ya no está, la ficha se quita igual: dejarla sería dejar en pantalla
           un apunte que no se puede abrir. */
      }
      await almacen.apuntes.borrar(a.id);
      avisar('Apunte eliminado');
    },
    [archivador, almacen, avisar],
  );

  /**
   * Borrar una carpeta se lleva lo de dentro, y por eso pregunta.
   *
   * Es la única acción de esta pantalla que puede destruir algo que no se está mirando:
   * una carpeta cerrada con veinte apuntes se ve igual que una vacía. Preguntar con la
   * cuenta delante —«y 20 apuntes»— es lo que convierte un clic en una decisión.
   */
  const borrarCarpeta = useCallback(
    async (c: Carpeta) => {
      const dentroC = carpetas.filter((x) => x.madre === c.id);
      const dentroA = apuntes.filter((a) => a.carpeta === c.id);
      const cuantos = dentroC.length + dentroA.length;
      if (cuantos > 0 && !window.confirm(`«${c.nombre}» tiene ${cuantos} cosa${cuantos === 1 ? '' : 's'} dentro. ¿Eliminarla con todo?`)) {
        return;
      }
      /* De dentro hacia fuera, para no dejar huérfano nada por el camino. */
      for (const a of dentroA) await borrar(a);
      for (const x of dentroC) await borrarCarpeta(x);
      try {
        await archivador.borrar(c.remoto as Remoto);
      } catch {
        /* en Drive la carpeta ya podría no estar; la ficha se va igual */
      }
      await almacen.carpetas.borrar(c.id);
      avisar('Carpeta eliminada');
    },
    [carpetas, apuntes, borrar, archivador, almacen, avisar],
  );

  const vacio = hijas.length === 0 && suyos.length === 0 && subiendo.length === 0 && fallidos.length === 0 && !creando;

  return (
    <mo.div
      className={`asig-apuntes${encima ? ' encima' : ''}`}
      variants={PIEZA}
      onDragEnter={(e) => {
        /* Solo el disco resalta el panel entero: un arrastre de dentro se suelta sobre una
           carpeta concreta, y marcar las dos cosas a la vez no dice dónde va a caer. */
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        cuenta.current++;
        setEncima(true);
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) e.preventDefault();
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
        void subir(e.dataTransfer.files);
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
              <span className="asig-barra" key={s.nombre}>
                <span className="asig-barra-txt">{s.nombre}</span>
                <span className="asig-barra-via" aria-hidden="true">
                  <mo.i animate={{ scaleX: s.tanto || 0.08 }} transition={MUELLE.normal} />
                </span>
              </span>
            ))}
          </mo.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {fallidos.length > 0 && (
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
              <span>
                {fallidos.length === 1 ? '1 apunte no llegó a Drive' : `${fallidos.length} apuntes no llegaron a Drive`}
              </span>
              <Button type="button" variant="outline" size="sm" onClick={() => void reintentar()} disabled={conectando}>
                {conectando ? 'Reconectando…' : fallidos.some((x) => x.caducada) ? 'Reconectar y reintentar' : 'Reintentar'}
              </Button>
              <button type="button" className="asig-fallos-x" onClick={() => setFallidos([])} aria-label="Descartar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <ul>
              {fallidos.map((x) => (
                <li key={x.f.name}>
                  <b>{x.f.name}</b>
                  <span>{x.motivo}</span>
                  <i>{x.arreglo}</i>
                </li>
              ))}
            </ul>
          </mo.div>
        )}
      </AnimatePresence>

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
                alEntrar={() => setAqui(c.id)}
                alRenombrar={() => setRenombrando(c.id)}
                alBautizar={(n) => void renombrar(c, n)}
                alCancelar={() => setRenombrando(null)}
                alBorrar={() => void borrarCarpeta(c)}
                alSoltar={(id, esC) => void mover(id, esC, c.id)}
                setSobre={setSobre}
              />
            ))}

            {suyos.map((a) => (
              <Fila
                key={a.id}
                apunte={a}
                editando={renombrando === a.id}
                alAbrir={() => setAbierto(a)}
                alRenombrar={() => setRenombrando(a.id)}
                alBautizar={(n) => void renombrar(a, n)}
                alCancelar={() => setRenombrando(null)}
                alBorrar={() => void borrar(a)}
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

      <Visor apunte={abierto} cerrar={() => setAbierto(null)} />
    </mo.div>
  );
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
      className={`asig-fila carp${marcada ? ' diana' : ''}`}
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: TIEMPO.roce, ease: CURVA.salida }}
      draggable={!editando}
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
          <button type="button" className="asig-abrir" onClick={alEntrar} title={carpeta.nombre}>
            <span className="asig-ico carp" aria-hidden="true">
              <IconoCarpeta />
            </span>
            <span className="asig-nombre">{carpeta.nombre}</span>
            <span className="asig-meta">Carpeta</span>
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
  alAbrir,
  alRenombrar,
  alBautizar,
  alCancelar,
  alBorrar,
}: {
  apunte: Apunte;
  editando: boolean;
  alAbrir: () => void;
  alRenombrar: () => void;
  alBautizar: (n: string) => void;
  alCancelar: () => void;
  alBorrar: () => void;
}) {
  const tipo = tipoDeFichero(apunte.tipo, apunte.nombre);
  const enDrive = apunte.remoto.proveedor === 'drive';
  return (
    <mo.li
      className="asig-fila"
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: TIEMPO.roce, ease: CURVA.salida }}
      draggable={!editando}
      onDragStartCapture={(e) => e.dataTransfer.setData(TIPO_ARRASTRE, `a:${apunte.id}`)}
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
          <button type="button" className="asig-abrir" onClick={alAbrir} title={apunte.nombre}>
            <span className="asig-ico" style={{ ['--tc' as string]: `var(--c-${tipo.color})` }} aria-hidden="true">
              <IconoDeFichero clase={tipo.clase} />
            </span>
            <span className="asig-nombre">{apunte.nombre}</span>
            <span className="asig-meta">
              {tipo.nombre} · {pesoLegible(apunte.tam)}
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
 */
function Visor({ apunte, cerrar }: { apunte: Apunte | null; cerrar: () => void }) {
  return <AnimatePresence>{apunte && <Contenido key="visor" apunte={apunte} cerrar={cerrar} />}</AnimatePresence>;
}

function Contenido({ apunte, cerrar }: { apunte: Apunte; cerrar: () => void }) {
  const archivador = elArchivador();
  const [url, setUrl] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const clase = seVeDentro(apunte.tipo, apunte.nombre);

  useEffect(() => {
    let vivo = true;
    let mio: string | null = null;
    archivador
      .enlace(apunte.remoto as Remoto)
      .then((u) => {
        if (!vivo) {
          /* llegó después de cerrar: se suelta en el acto o se queda en memoria */
          archivador.soltar(u);
          return;
        }
        mio = u;
        setUrl(u);
      })
      .catch((e) => {
        if (vivo) setFallo(e instanceof FalloDeArchivo ? e.message : 'No se pudo abrir este apunte.');
      });
    return () => {
      vivo = false;
      if (mio) archivador.soltar(mio);
    };
  }, [apunte, archivador]);

  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => e.key === 'Escape' && cerrar();
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [cerrar]);

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
          {url && (
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

        <div className="visor-cuerpo">
          {fallo ? (
            <p className="visor-aviso">{fallo}</p>
          ) : !url ? (
            <p className="visor-aviso">Abriendo…</p>
          ) : clase === 'imagen' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={apunte.nombre} />
          ) : clase === 'video' ? (
            /* Con controles y sin reproducción automática: un vídeo que arranca solo al
               abrirlo asusta más que ayuda, sobre todo con auriculares puestos. */
            <video src={url} controls playsInline />
          ) : clase === 'pdf' ? (
            <iframe src={url} title={apunte.nombre} />
          ) : (
            <div className="visor-nada">
              <p>Este formato no se puede ver aquí dentro.</p>
              <a className="visor-descargar" href={url} download={apunte.nombre}>
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
