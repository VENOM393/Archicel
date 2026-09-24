'use client';

/**
 * Los ajustes de la usuaria.
 *
 * Hoy son dos cosas y ni una más: **quién es** —la cuenta de Archicel, y con ella dónde
 * se guardan sus cosas— y **a qué Drive van los apuntes**. La cuenta ya tenía sitio en el
 * menú del avatar; lo que no tenía sitio era la conexión con Google, y sin él no había
 * forma de desconectarla ni de ver con qué cuenta se concedió.
 *
 * Una pantalla y no un trozo más del menú por dos motivos. Desconectar pide confirmación y
 * explicar qué pasa con los apuntes, y eso no cabe en una caja de 266 px sin convertirla en
 * un formulario. Y al volver de aquí la página de una asignatura se monta de nuevo, así que
 * enseña «Sin conectar» sin tener que escuchar nada.
 *
 * Tres decisiones del contrato visual:
 *
 *   · **La portada es tipografía sobre la fotografía**, como la de una asignatura. El único
 *     cristal es el panel de Drive, que es donde se trabaja.
 *   · **Una sola acción sólida, y solo cuando crea algo**: conectar. Desconectar es contorno,
 *     y su confirmación es el único sitio donde aparece el rojo de lo que no se deshace.
 *   · **La confirmación sustituye a la fila de acciones**, no abre una ventana. No hay nada
 *     detrás que proteger, y así la pregunta sale justo donde estaba el dedo.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as mo from 'motion/react-m';
import { AnimatePresence } from 'motion/react';

import { Button } from '@/components/ui/button';
import {
  alCambiarDrive,
  deQuienEsElDrive,
  desconectarDrive,
  driveConectado,
  driveRecordado,
  elArchivador,
  sePuedeUsarDrive,
} from '@/lib/archivo';
import { useArchicel } from '@/lib/firebase/sesion';
import { useUI } from '@/lib/ui/contexto';
import { ORQUESTA, PIEZA, RELEVO } from '@/lib/ui/movimiento';
import { USUARIA } from '@/lib/data';

/** Donde se retira a mano el permiso de una aplicación en una cuenta de Google. */
const PERMISOS_GOOGLE = 'https://myaccount.google.com/connections';

export default function Ajustes() {
  const { usuario, enLaNube } = useArchicel();

  return (
    <mo.section className="vista on ajustes" variants={ORQUESTA} aria-labelledby="ajustes-titulo">
      <mo.header className="aj-portada" variants={PIEZA}>
        <h1 id="ajustes-titulo">Ajustes</h1>
        <p className="aj-quien">
          <b>{usuario?.displayName ?? usuario?.email ?? USUARIA}</b>
          {usuario?.email && usuario.displayName && (
            <>
              <i aria-hidden="true" />
              <span className="aj-mono">{usuario.email}</span>
            </>
          )}
          <span className="aj-donde">
            <span className={`cuenta-pt${enLaNube ? ' nube' : ''}`} aria-hidden="true" />
            {enLaNube ? 'Tus cosas se guardan en la nube y en este equipo' : 'Tus cosas se guardan solo en este equipo'}
          </span>
        </p>
      </mo.header>

      <PanelDrive />
    </mo.section>
  );
}

/* ───────────────────────── Drive ───────────────────────── */

type Estado = 'sin-configurar' | 'conectado' | 'caducado' | 'sin-conectar';

/** Se lee del navegador, así que solo después de montar: en el servidor no hay token. */
function leerEstado(): Estado {
  if (!sePuedeUsarDrive()) return 'sin-configurar';
  if (driveConectado()) return 'conectado';
  if (driveRecordado()) return 'caducado';
  return 'sin-conectar';
}

const ROTULO: Record<Estado, string> = {
  conectado: 'Conectado',
  caducado: 'Caducado',
  'sin-conectar': 'Sin conectar',
  'sin-configurar': 'No configurado',
};

function PanelDrive() {
  const { avisar } = useUI();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [correo, setCorreo] = useState<string | null>(null);
  const [preguntando, setPreguntando] = useState(false);
  const [trabajando, setTrabajando] = useState<'conectando' | 'desconectando' | null>(null);
  /** Si al desconectar Google no confirmó la retirada: se dice hasta la siguiente acción. */
  const [sinConfirmar, setSinConfirmar] = useState(false);

  /*
   * El foco, con refs de callback y no con un `requestAnimationFrame`.
   *
   * La pregunta y la fila de acciones se relevan con `mode="wait"`: la que entra no existe
   * hasta que la otra ha terminado de irse, unos 200 ms después. Enfocar en el fotograma
   * siguiente encontraba el botón todavía sin montar y el foco se quedaba en la página.
   * Así se enfoca exactamente cuando el botón llega.
   */
  const devolverFoco = useRef(false);
  /* En la pregunta, a «Cancelar»: lo que no se deshace no debe estar a un Intro. */
  const enfocarCancelar = useCallback((nodo: HTMLButtonElement | null) => {
    nodo?.focus({ preventScroll: true });
  }, []);
  /* Al cerrarla, al botón de la fila que llegue: el que la abrió, o «Conectar» si ya
     no hay nada que desconectar. Nunca al principio de la página. */
  const recibirFoco = useCallback((nodo: HTMLButtonElement | null) => {
    if (!nodo || !devolverFoco.current) return;
    devolverFoco.current = false;
    nodo.focus({ preventScroll: true });
  }, []);

  const refrescar = useCallback(() => {
    const e = leerEstado();
    setEstado(e);
    if (e === 'conectado') void deQuienEsElDrive().then(setCorreo);
    else setCorreo(null);
  }, []);

  /* Al montar, y cada vez que se conecte o desconecte —aquí o en otra pestaña—. */
  useEffect(() => {
    refrescar();
    return alCambiarDrive(refrescar);
  }, [refrescar]);

  const conectar = useCallback(async () => {
    setTrabajando('conectando');
    setSinConfirmar(false);
    try {
      await elArchivador().conectar();
      avisar('Drive conectado');
    } catch (e) {
      avisar(e instanceof Error && e.message ? e.message : 'No se pudo conectar con Drive');
    } finally {
      setTrabajando(null);
      refrescar();
    }
  }, [avisar, refrescar]);

  const desconectar = useCallback(async () => {
    setTrabajando('desconectando');
    try {
      const confirmado = await desconectarDrive();
      setSinConfirmar(!confirmado);
      avisar('Drive desconectado');
    } finally {
      devolverFoco.current = true;
      setPreguntando(false);
      setTrabajando(null);
      refrescar();
    }
  }, [avisar, refrescar]);

  const cancelar = useCallback(() => {
    devolverFoco.current = true;
    setPreguntando(false);
  }, []);

  /* Escape cierra la pregunta, que es lo primero que se intenta. */
  useEffect(() => {
    if (!preguntando) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !trabajando) cancelar();
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [preguntando, trabajando, cancelar]);

  const deQuien = correo ?? 'tu cuenta de Google';

  return (
    <mo.section className="aj-panel" variants={PIEZA} aria-labelledby="aj-drive">
      <header className="aj-cab">
        <span className="aj-ico" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3.6 20.2 8v8L12 20.4 3.8 16V8Z" />
            <path d="M3.8 8 12 12.4 20.2 8M12 12.4v8" />
          </svg>
        </span>
        <h2 id="aj-drive">Google Drive</h2>
        <span className={`aj-estado${estado === 'conectado' ? ' si' : ''}`} role="status" aria-live="polite">
          <span className="aj-pt" aria-hidden="true" />
          {estado ? ROTULO[estado] : 'Comprobando…'}
        </span>
      </header>

      {/* Hasta saber el estado no se pinta nada: pintar «Sin conectar» y cambiarlo un
          instante después a «Conectado» se lee como una desconexión. */}
      {estado && (
        <AnimatePresence mode="wait" initial={false}>
          <mo.div
            key={estado}
            className="aj-cuerpo"
            variants={RELEVO}
            initial="fuera"
            animate="dentro"
            exit="saliendo"
          >
            <Titular estado={estado} deQuien={deQuien} />

            <dl className="aj-hechos">
              <div>
                <dt>Permiso</dt>
                <dd>Solo lo que Archicel crea. El resto de tu Drive no lo ve.</dd>
              </div>
              <div>
                <dt>Carpeta</dt>
                <dd className="aj-mono">Archicel / Asignaturas</dd>
              </div>
              <div>
                <dt>Vale en</dt>
                <dd>Este navegador. En otro equipo se conecta aparte, y puede ser otra cuenta.</dd>
              </div>
            </dl>

            {sinConfirmar && estado === 'sin-conectar' && (
              <p className="aj-nota">
                Archicel ya no guarda ningún acceso en este navegador, pero Google no confirmó que haya
                retirado el permiso —pasa si la sesión ya había caducado—. Si quieres quitarlo también de tu
                cuenta, está en{' '}
                <a href={PERMISOS_GOOGLE} target="_blank" rel="noreferrer">
                  Cuenta de Google → Conexiones
                </a>
                .
              </p>
            )}

            <AnimatePresence mode="wait" initial={false}>
              {preguntando ? (
                <mo.div
                  key="pregunta"
                  className="aj-pie aj-pregunta"
                  role="alertdialog"
                  aria-labelledby="aj-pregunta-t"
                  aria-describedby="aj-pregunta-d"
                  variants={RELEVO}
                  initial="fuera"
                  animate="dentro"
                  exit="saliendo"
                >
                  <div className="aj-texto">
                    <b id="aj-pregunta-t">¿Desconectar el Drive de {deQuien}?</b>
                    <p id="aj-pregunta-d">
                      Hasta que vuelvas a conectarlo no podrás subir ni abrir apuntes desde aquí. No se borra
                      nada: los ficheros siguen en Drive y sus fichas en Archicel.
                    </p>
                  </div>
                  <div className="aj-botones">
                    <Button ref={enfocarCancelar} type="button" variant="ghost" onClick={cancelar} disabled={Boolean(trabajando)}>
                      Cancelar
                    </Button>
                    <Button type="button" variant="destructive" onClick={() => void desconectar()} disabled={Boolean(trabajando)}>
                      {trabajando === 'desconectando' ? 'Desconectando…' : 'Desconectar'}
                    </Button>
                  </div>
                </mo.div>
              ) : (
                <mo.div key="acciones" className="aj-pie" variants={RELEVO} initial="fuera" animate="dentro" exit="saliendo">
                  <p className="aj-texto">
                    <Explicacion estado={estado} />
                  </p>
                  <div className="aj-botones">
                    {(estado === 'sin-conectar' || estado === 'caducado') && (
                      <Button ref={recibirFoco} type="button" onClick={() => void conectar()} disabled={Boolean(trabajando)}>
                        {trabajando === 'conectando'
                          ? 'Conectando…'
                          : estado === 'caducado'
                            ? 'Renovar ahora'
                            : 'Conectar Drive'}
                      </Button>
                    )}
                    {(estado === 'conectado' || estado === 'caducado') && (
                      <Button
                        ref={recibirFoco}
                        type="button"
                        variant="outline"
                        onClick={() => setPreguntando(true)}
                        disabled={Boolean(trabajando)}
                      >
                        Desconectar Drive
                      </Button>
                    )}
                  </div>
                </mo.div>
              )}
            </AnimatePresence>
          </mo.div>
        </AnimatePresence>
      )}
    </mo.section>
  );
}

/** Lo grande del panel: a dónde van los apuntes, o por qué ahora no van a ningún sitio. */
function Titular({ estado, deQuien }: { estado: Estado; deQuien: string }) {
  switch (estado) {
    case 'conectado':
      return (
        <div className="aj-titular">
          <span>Los apuntes van al Drive de</span>
          <strong title={deQuien}>{deQuien}</strong>
        </div>
      );
    case 'caducado':
      return (
        <div className="aj-titular">
          <span>Conectado, pero la sesión de Google caducó</span>
          <strong>Se renueva sola al subir algo</strong>
        </div>
      );
    case 'sin-conectar':
      return (
        <div className="aj-titular">
          <span>Los apuntes solo se guardan en Drive</span>
          <strong>Ningún Drive conectado</strong>
        </div>
      );
    case 'sin-configurar':
      return (
        <div className="aj-titular">
          <span>Esta instalación no tiene acceso a Google</span>
          <strong>Drive no está configurado</strong>
        </div>
      );
  }
}

function Explicacion({ estado }: { estado: Estado }) {
  switch (estado) {
    case 'conectado':
      return <>Desconectar retira el permiso y lo olvida en este navegador. No borra nada de tu Drive.</>;
    case 'caducado':
      return <>El permiso de Google dura una hora. Renovarlo abre una ventana de Google un instante.</>;
    case 'sin-conectar':
      return <>Nada nuevo se guarda en este equipo: sin Drive conectado no se puede subir.</>;
    case 'sin-configurar':
      return <>Falta el identificador de cliente de Google en el despliegue.</>;
  }
}
