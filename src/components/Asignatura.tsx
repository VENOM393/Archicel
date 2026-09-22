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
import { useAhora, useApuntes, useEventos } from '@/hooks/useDatos';
import { useUI } from '@/lib/ui/contexto';
import { useArchicel } from '@/lib/firebase/sesion';
import {
  deQuienEsElDrive,
  driveConectado,
  driveEsLoNormal,
  elArchivador,
  nombreDeTipo,
  pesoLegible,
  reconectarDriveEnSilencio,
  sePuedeUsarDrive,
  seVeDentro,
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

interface Subiendo {
  nombre: string;
  tanto: number;
}

function Apuntes({ clave, apuntes }: { clave: ClaveAsignatura; apuntes: Apunte[] }) {
  const { almacen } = useArchicel();
  const { avisar } = useUI();
  const archivador = elArchivador();
  const entrada = useRef<HTMLInputElement>(null);
  const [encima, setEncima] = useState(false);
  const [subiendo, setSubiendo] = useState<Subiendo[]>([]);
  const [abierto, setAbierto] = useState<Apunte | null>(null);

  /**
   * Si Drive está conectado en esta pestaña.
   *
   * Vive en estado y no se lee del módulo en cada render porque conectar no provoca un
   * render por sí solo: es una promesa que se resuelve fuera de React.
   *
   * Y arranca en `false` a propósito, incluso si ya hubiera permiso: el servidor
   * prerrenderiza esta página y allí no hay ni ventana ni token. Decidirlo durante el
   * render daría dos árboles distintos y React se quejaría al hidratar.
   */
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
      /* El motivo concreto vale mucho más que un «no se pudo»: cerrar la ventana,
         bloquearla el navegador y no tener permiso se arreglan de formas distintas, y
         quien lo lee necesita saber cuál de las tres le ha pasado. */
      avisar(e instanceof Error && e.message ? e.message : 'No se pudo conectar con Drive');
    } finally {
      setConectando(false);
    }
  }, [archivador, avisar]);

  /**
   * El contador de arrastre, y por qué no basta un booleano.
   *
   * `dragenter` y `dragleave` se disparan también al cruzar de un hijo a otro dentro de la
   * misma zona. Con una bandera, el resalte parpadea cada vez que el puntero pasa por
   * encima de una fila. Contando entradas y salidas, el resalte solo se apaga cuando se
   * sale de verdad.
   */
  const cuenta = useRef(0);

  /**
   * Lo que no ha podido subir, con su motivo y el fichero todavía en la mano.
   *
   * Un aviso que se va en tres segundos es el peor sitio donde poner un fallo: cuentas
   * cinco ficheros arrastrados, ves «no se pudo subir» de reojo y no sabes cuál de los
   * cinco fue, ni por qué, ni tienes forma de repetirlo sin volver a buscarlo en el disco.
   *
   * Guardando el `File` —que sigue siendo válido mientras la página viva— el reintento es
   * un botón, no una expedición.
   */
  const [fallidos, setFallidos] = useState<Array<{ f: File; motivo: string; caducada: boolean }>>([]);

  const subir = useCallback(
    async (ficheros: FileList | File[]) => {
      const lista = [...ficheros];
      if (lista.length === 0) return;

      setFallidos([]);
      setSubiendo(lista.map((f) => ({ nombre: f.name, tanto: 0 })));
      const arranque = Date.now();
      let bien = 0;
      const malos: Array<{ f: File; motivo: string; caducada: boolean }> = [];

      for (const fichero of lista) {
        try {
          const remoto = await archivador.subir(fichero, { asignatura: clave }, (tanto) =>
            setSubiendo((s) => s.map((x) => (x.nombre === fichero.name ? { ...x, tanto } : x))),
          );

          /*
           * Se guardó, pero no donde tocaba.
           *
           * Pasa cuando la sesión de Drive ha caducado y ni renovándola se pudo: el
           * fichero se queda en el equipo, que es mejor que perderlo, **pero hay que
           * decirlo**. Un apunte que crees en la nube y está en el portátil es justo el
           * que no vas a tener el día que abras esto en otro sitio.
           */
          if (remoto.proveedor === 'local' && driveEsLoNormal()) {
            malos.push({ f: fichero, motivo: 'Guardado en este equipo: la sesión de Drive caducó.', caducada: true });
            setEnDrive(false);
          } else if (remoto.proveedor === 'drive' && !enDrive) {
            /*
             * Se renovó sola por el camino.
             *
             * La cabecera se calcula al montar la página, así que tras una renovación a
             * mitad de subida decía «Guardados en este equipo» mientras las filas ya
             * llevaban su flecha a Drive. Dos sitios de la misma pantalla contando cosas
             * distintas sobre lo mismo, que es peor que cualquiera de las dos por
             * separado.
             */
            setEnDrive(true);
            void deQuienEsElDrive().then(setCorreo);
          }
          await almacen.apuntes.guardar({
            asignatura: clave,
            nombre: fichero.name,
            tipo: fichero.type,
            tam: fichero.size,
            remoto,
            creado: Date.now(),
          });
          bien++;
        } catch (e) {
          /*
           * El motivo concreto, no un «no se pudo».
           *
           * Las causas tienen nombre precisamente para esto, y tragárselas dejaba el mismo
           * mensaje para «no queda sitio», «se cayó la red» y «Drive dice que ese padre no
           * existe» — tres cosas que se arreglan de tres formas distintas. Un mensaje que
           * no distingue no es prudencia: es perder la única pista que había.
           */
          const f = e instanceof FalloDeArchivo ? e : null;
          const bloqueada = e instanceof Error && /bloque|ventana/i.test(e.message);
          /* «Caducada» es el caso que hay que tratar aparte: no es una avería, es que la
             hora pasó y hay que volver a dar permiso. Su arreglo es un botón distinto. */
          const caducada = f?.causa === 'sin-permiso' || bloqueada || (!f && e instanceof Error);
          const motivo =
            f?.causa === 'sin-sitio'
              ? f.message
              : f?.causa === 'demasiado-grande'
                ? 'Es demasiado grande.'
                : f?.causa === 'red'
                  ? 'Se cortó la conexión.'
                  : caducada
                    ? 'La sesión de Drive ha caducado.'
                    : (f?.message ?? (e instanceof Error ? e.message : 'Fallo desconocido.'));

          malos.push({ f: fichero, motivo, caducada });
          /* Y en la consola, entero: el aviso cabe en una línea y esto no siempre. */
          console.error('[archicel] subida fallida', fichero.name, e);
        }
      }

      /* Una subida de 40 ms enseña y esconde la barra en el mismo parpadeo, y eso se lee
         como un fallo y no como algo que ha ido rápido. */
      const falta = MINIMO_VISIBLE - (Date.now() - arranque);
      if (falta > 0) await new Promise((r) => setTimeout(r, falta));
      setSubiendo([]);
      setFallidos(malos);

      /* El aviso solo cuenta lo que salió bien. Lo que salió mal se queda en pantalla con
         su motivo y su botón, que es donde se puede hacer algo al respecto. */
      if (bien > 0) avisar(bien === 1 ? 'Apunte guardado' : `${bien} apuntes guardados`);
    },
    [archivador, almacen, clave, avisar, enDrive],
  );

  /**
   * Reintentar.
   *
   * Si lo que falló fue la sesión, **primero se reconecta y después se sube**, y en ese
   * orden: reconectar abre la ventana de Google, y eso solo se puede hacer mientras dure
   * el permiso que deja este clic. Meter una subida por delante se lo gasta.
   */
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

  return (
    <mo.div
      className={`asig-apuntes${encima ? ' encima' : ''}`}
      variants={PIEZA}
      onDragEnter={(e) => {
        e.preventDefault();
        cuenta.current++;
        setEncima(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        cuenta.current = Math.max(0, cuenta.current - 1);
        if (cuenta.current === 0) setEncima(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        cuenta.current = 0;
        setEncima(false);
        void subir(e.dataTransfer.files);
      }}
    >
      <div className="asig-cab">
        <h2>Apuntes</h2>
        {/* La cuenta, cuando se sabe. Llega una fracción de segundo después del estado
            y por eso hay dos textos y no uno: enseñar «En el Drive de …» con el hueco
            vacío mientras llega se lee peor que decir «En tu Drive» y precisarlo luego. */}
        <span className="asig-donde" title={correo ?? undefined}>
          {enDrive ? (correo ? `En el Drive de ${correo}` : 'En tu Drive') : 'Guardados en este equipo'}
        </span>

        {/* Una oferta, no un muro: la página funciona sin esto y por eso el botón es
            fantasma. La única pieza sólida de la pantalla sigue siendo la que crea algo. */}
        {!enDrive && sePuedeUsarDrive() && (
          <Button type="button" variant="ghost" onClick={() => void conectar()} disabled={conectando}>
            {conectando ? 'Conectando…' : 'Conectar Drive'}
          </Button>
        )}
        <Button type="button" onClick={() => entrada.current?.click()}>
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
            /* sin esto, subir dos veces el mismo fichero no dispara `change` */
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

      {/* Lo que no subió, con su motivo y un botón. Va **encima** de la lista y no en un
          aviso: es lo único de esta pantalla que le pide algo a quien la mira. */}
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
                {fallidos.length === 1
                  ? `1 apunte no llegó a ${driveEsLoNormal() ? 'Drive' : 'guardarse'}`
                  : `${fallidos.length} apuntes no llegaron a ${driveEsLoNormal() ? 'Drive' : 'guardarse'}`}
              </span>
              <Button type="button" variant="outline" size="sm" onClick={() => void reintentar()} disabled={conectando}>
                {conectando
                  ? 'Reconectando…'
                  : fallidos.some((x) => x.caducada)
                    ? 'Reconectar y reintentar'
                    : 'Reintentar'}
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
                </li>
              ))}
            </ul>
          </mo.div>
        )}
      </AnimatePresence>

      {apuntes.length === 0 && subiendo.length === 0 && fallidos.length === 0 ? (
        <div className="asig-vacio">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h3l2 2.5h6A2.5 2.5 0 0 1 20 10v7a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17Z" />
          </svg>
          <p>Arrastra aquí tus fotos de pizarra, los PDF de teoría o lo que te manden.</p>
        </div>
      ) : (
        <ul className="asig-lista">
          {apuntes.map((a) => (
            <Fila key={a.id} apunte={a} alAbrir={() => setAbierto(a)} alBorrar={() => void borrar(a)} />
          ))}
        </ul>
      )}

      {/* El velo del arrastre va dentro del panel y no es un segundo cristal: es un
          relleno y un filete, que es como el contrato visual pide separar superficies. */}
      <AnimatePresence>
        {encima && (
          <mo.span className="asig-suelta" key="suelta" variants={VELO} initial="fuera" animate="dentro" exit="saliendo" aria-hidden="true">
            Suéltalo aquí
          </mo.span>
        )}
      </AnimatePresence>

      <Visor apunte={abierto} cerrar={() => setAbierto(null)} />
    </mo.div>
  );
}

function Fila({ apunte, alAbrir, alBorrar }: { apunte: Apunte; alAbrir: () => void; alBorrar: () => void }) {
  const clase = seVeDentro(apunte.tipo, apunte.nombre);
  /*
   * A dónde fue a parar de verdad.
   *
   * Hacía falta y no estaba: la cabecera dice «En tu Drive» pero eso describe dónde irá lo
   * **próximo**, no dónde está cada cosa — y con dos archivadores conviviendo, una lista
   * donde todo se ve igual no permite distinguir lo que está a salvo en la nube de lo que
   * solo está en este equipo. El enlace resuelve las dos cosas a la vez: lo dice y lleva.
   */
  const enDrive = apunte.remoto.proveedor === 'drive';
  return (
    <li className="asig-fila">
      <button type="button" className="asig-abrir" onClick={alAbrir} title={apunte.nombre}>
        <span className={`asig-ico tipo-${clase}`} aria-hidden="true">
          <IconoDeTipo clase={clase} />
        </span>
        <span className="asig-nombre">{apunte.nombre}</span>
        <span className="asig-meta">
          {nombreDeTipo(apunte.tipo, apunte.nombre)} · {pesoLegible(apunte.tam)}
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
      <button type="button" className="asig-quitar" onClick={alBorrar} aria-label={`Eliminar ${apunte.nombre}`}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13h10l1-13" />
        </svg>
      </button>
    </li>
  );
}

function IconoDeTipo({ clase }: { clase: 'imagen' | 'pdf' | 'no' }) {
  const comun = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (clase === 'imagen')
    return (
      <svg {...comun}>
        <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
        <circle cx="9" cy="10" r="1.4" />
        <path d="m4.5 17 4.2-4.2a1.6 1.6 0 0 1 2.3 0L16 17.5" />
      </svg>
    );
  if (clase === 'pdf')
    return (
      <svg {...comun}>
        <path d="M14 3.5H7.5A1.5 1.5 0 0 0 6 5v14a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19V7.5Z" />
        <path d="M14 3.5V7a.5.5 0 0 0 .5.5H18" />
        <path d="M9 14h6M9 17h4" />
      </svg>
    );
  return (
    <svg {...comun}>
      <path d="M14 3.5H7.5A1.5 1.5 0 0 0 6 5v14a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19V7.5Z" />
      <path d="M14 3.5V7a.5.5 0 0 0 .5.5H18" />
    </svg>
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
