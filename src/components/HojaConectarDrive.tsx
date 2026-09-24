'use client';

/**
 * El asistente para conectar Drive.
 *
 * No suelta la ventana de Google a secas: la prepara. Conectar Drive es dar un permiso, y
 * un permiso que salta sin contexto se cierra por reflejo; uno que se entiende antes —qué
 * guarda, qué ve y qué no, con qué cuenta— se concede. Por eso hay tres pasos que explican
 * y solo el tercero abre la ventana, y una pantalla final que dice de quién ha quedado el
 * Drive, que es la única forma de cazar el error de conceder con la cuenta que no era.
 *
 * Sube desde abajo como las hojas de edición y se cierra igual —telón, Escape, foco
 * atrapado— porque una pieza modal que se comporta distinta de las otras se nota aunque
 * nadie sepa decir por qué.
 */

import { useMemo, useState } from 'react';
import * as m from 'motion/react-m';
import { AnimatePresence } from 'motion/react';

import { HOJA, VELO, RELEVO } from '@/lib/ui/movimiento';
import { useDialogo } from '@/hooks/useDialogo';
import { Button } from '@/components/ui/button';
import { deQuienEsElDrive, elArchivador } from '@/lib/archivo';

/**
 * La marca de Drive, dibujada a trazo y en un solo color.
 *
 * El logotipo real es de tres colores; aquí sería un segundo saturado peleando con el de
 * la asignatura, y el contrato visual lo prohíbe. Así que es el triángulo de Drive en la
 * misma familia de trazo que el resto de iconos, teñido con el único acento de la casa.
 */
export function IconoDrive({ tam = 26 }: { tam?: number }) {
  return (
    <svg
      width={tam}
      height={tam}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M24 7 41 38H7Z" />
      <path d="M24 27.7 15.5 22.5M24 27.7 32.5 22.5M24 27.7V38" />
    </svg>
  );
}

type Paso = 'intro' | 'permiso' | 'elegir' | 'listo';

const ORDEN: Paso[] = ['intro', 'permiso', 'elegir'];

export function HojaConectarDrive({
  abierto,
  cerrar,
  alConectado,
}: {
  abierto: boolean;
  cerrar: () => void;
  alConectado: (correo: string | null) => void;
}) {
  return (
    <AnimatePresence>
      {abierto && <Contenido key="asistente" cerrar={cerrar} alConectado={alConectado} />}
    </AnimatePresence>
  );
}

function Contenido({
  cerrar,
  alConectado,
}: {
  cerrar: () => void;
  alConectado: (correo: string | null) => void;
}) {
  const caja = useDialogo<HTMLElement>(true, cerrar);
  const archivador = useMemo(() => elArchivador(), []);

  const [paso, setPaso] = useState<Paso>('intro');
  const [conectando, setConectando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [correo, setCorreo] = useState<string | null>(null);

  const conectar = async () => {
    setError(null);
    setConectando(true);
    try {
      await archivador.conectar();
      /* Saber de quién es es una comodidad, no un requisito: si `about` falla, la pantalla
         final lo dice sin correo y todo lo demás sigue conectado. */
      let email: string | null = null;
      try {
        email = await deQuienEsElDrive();
      } catch {
        email = null;
      }
      setCorreo(email);
      alConectado(email);
      setPaso('listo');
    } catch (e) {
      /* Cerrar la ventana de Google sin conceder no es una caída: es un «ahora no». Se dice
         suave y se deja el botón para reintentar, sin salir del asistente. */
      setError(e instanceof Error && e.message ? e.message : 'Se cerró la ventana de Google sin conectar.');
    } finally {
      setConectando(false);
    }
  };

  const indice = ORDEN.indexOf(paso);

  return (
    <>
      <m.div className="telon" variants={VELO} initial="fuera" animate="dentro" exit="saliendo" onClick={cerrar} />
      <m.aside
        ref={caja}
        tabIndex={-1}
        className="hoja asist"
        variants={HOJA}
        initial="fuera"
        animate="dentro"
        exit="saliendo"
        role="dialog"
        aria-modal="true"
        aria-label="Conectar Drive"
      >
        <button type="button" className="asist-x" onClick={cerrar} aria-label="Cerrar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>

        <span className="asist-marca" aria-hidden="true">
          <IconoDrive tam={30} />
        </span>

        <div className="asist-cuerpo">
          <AnimatePresence mode="wait" initial={false}>
            {paso === 'intro' && (
              <m.div key="intro" className="asist-paso" variants={RELEVO} initial="fuera" animate="dentro" exit="saliendo">
                <h3>Tus apuntes, en tu Drive</h3>
                <p>
                  Aquí van tus fotos de pizarra, los PDF de teoría y las láminas escaneadas. No se
                  guardan en Archicel: se guardan en tu propio Google Drive. Son tuyos —los abres
                  desde Drive cuando quieras— y si algún día dejas esto, se quedan donde están.
                </p>
              </m.div>
            )}

            {paso === 'permiso' && (
              <m.div key="permiso" className="asist-paso" variants={RELEVO} initial="fuera" animate="dentro" exit="saliendo">
                <h3>Archicel solo ve lo que crea aquí</h3>
                <p>
                  Google le da un permiso concreto, <span className="asist-cod">drive.file</span>:
                  Archicel solo puede ver los ficheros que sube ella misma. El resto de tu Drive —tus
                  fotos, tus documentos— le es invisible. No puede leerlo ni aunque quisiera.
                </p>
              </m.div>
            )}

            {paso === 'elegir' && (
              <m.div key="elegir" className="asist-paso" variants={RELEVO} initial="fuera" animate="dentro" exit="saliendo">
                <h3>Elige tu cuenta</h3>
                <p>
                  Se abrirá una ventana de Google para que elijas con qué cuenta conectar. Si tienes
                  varias abiertas, cuidado: elige la tuya, porque ahí es donde vivirán los apuntes.
                </p>
                {error && (
                  <p className="asist-error" role="status">
                    {error}
                  </p>
                )}
              </m.div>
            )}

            {paso === 'listo' && (
              <m.div key="listo" className="asist-paso" variants={RELEVO} initial="fuera" animate="dentro" exit="saliendo">
                <span className="asist-hecho" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 12.5 4.5 4.5L19 7" />
                  </svg>
                </span>
                <h3>Todo listo</h3>
                <p>
                  {correo ? (
                    <>
                      Conectado al Drive de <b className="asist-correo">{correo}</b>. Ya puedes subir
                      apuntes y organizarlos en carpetas.
                    </>
                  ) : (
                    <>Tu Drive está conectado. Ya puedes subir apuntes y organizarlos en carpetas.</>
                  )}
                </p>
              </m.div>
            )}
          </AnimatePresence>
        </div>

        {paso !== 'listo' && (
          <div className="asist-pasos" aria-hidden="true">
            {ORDEN.map((p, i) => (
              <span className={`asist-punto${i === indice ? ' on' : ''}${i < indice ? ' hecho' : ''}`} key={p} />
            ))}
          </div>
        )}

        <div className="asist-pie">
          {paso === 'intro' && (
            <Button type="button" className="asist-ir" onClick={() => setPaso('permiso')}>
              Empezar
            </Button>
          )}

          {paso === 'permiso' && (
            <>
              <Button type="button" variant="outline" onClick={() => setPaso('intro')}>
                Atrás
              </Button>
              <Button type="button" className="asist-ir" onClick={() => setPaso('elegir')}>
                Siguiente
              </Button>
            </>
          )}

          {paso === 'elegir' && (
            <>
              <Button type="button" variant="outline" onClick={() => setPaso('permiso')} disabled={conectando}>
                Atrás
              </Button>
              <Button type="button" className="asist-ir" onClick={() => void conectar()} disabled={conectando}>
                {conectando ? 'Conectando…' : error ? 'Reintentar' : 'Conectar Drive'}
              </Button>
            </>
          )}

          {paso === 'listo' && (
            <Button type="button" className="asist-ir" onClick={cerrar}>
              Empezar
            </Button>
          )}
        </div>
      </m.aside>
    </>
  );
}
