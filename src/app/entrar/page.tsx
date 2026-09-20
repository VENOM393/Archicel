'use client';

/**
 * La pantalla de acceso.
 *
 * Un solo panel partido en dos: la marca dibujándose a la izquierda y el formulario a la
 * derecha. Es la única pantalla de Archicel que no se apoya en la fotografía —ahí está
 * explicado, en `docs/design/DESIGN.md`— y la única que no lleva ni raíl ni cabecera.
 *
 * ## Aquí solo se entra
 *
 * No hay registro. Archicel tiene dos cuentas y ninguna se crea sola: se dan de alta en
 * la consola de Firebase. Un formulario de alta en una aplicación privada no es una
 * comodidad, es una puerta que no tendría por qué existir — y además obligaba a esta
 * pantalla a doblarse en dos modos, con el doble de campos, el doble de validaciones y un
 * conmutador que había que explicar.
 *
 * Tres decisiones que vienen del contrato visual y no del gusto:
 *
 *   · **Una sola acción sólida.** El botón que crea la sesión. Google va en contorno y lo
 *     demás es texto.
 *   · **Sin cristal dentro del cristal.** El panel flota sobre el cielo con su
 *     desenfoque; las dos mitades se separan con una línea de 1 px y un cambio de
 *     relleno, nunca con un segundo blur.
 *   · **Un solo protagonista del movimiento**: la entrada del panel y el trazo que se
 *     dibuja. Lo demás son respuestas al dedo de 240 ms.
 *
 * Y una que viene del producto: **abajo se puede seguir sin cuenta**. Archicel no es un
 * servicio al que haya que registrarse, es de ella; la cuenta solo sirve para que sus
 * cosas la sigan a otro dispositivo.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Firma } from '@/components/Firma';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useArchicel } from '@/lib/firebase/sesion';

export default function Entrar() {
  const router = useRouter();
  const { usuario, cargando, hayCuentas, entrarConGoogle, entrarConCorreo, recuperar, salir, error, limpiarError } =
    useArchicel();

  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [mayusculas, setMayusculas] = useState(false);
  const [trabajando, setTrabajando] = useState<'correo' | 'google' | 'recuperar' | null>(null);
  const [entrado, setEntrado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const primerCampo = useRef<HTMLInputElement>(null);

  /* El foco entra donde se empieza a escribir, no en el borde de la página. */
  useEffect(() => {
    if (!cargando && !usuario) primerCampo.current?.focus({ preventScroll: true });
  }, [cargando, usuario]);

  /* El escritorio se pide antes de que haga falta: cuando la sesión llega, ya está. */
  useEffect(() => {
    router.prefetch('/');
  }, [router]);

  /**
   * Bloq Mayús encendido con un campo de contraseña delante.
   *
   * Es la causa número uno de «mi contraseña no funciona» y el navegador no avisa de
   * ella en ninguna parte. Detectarlo cuesta una línea y ahorra un intento fallido, un
   * mensaje de error que no explica nada y, con suerte, un correo de recuperación.
   */
  const mirarMayusculas = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    setMayusculas(e.getModifierState?.('CapsLock') ?? false);
  }, []);

  /** Lo que se puede comprobar aquí se comprueba aquí: el viaje al servidor sobra. */
  function revisar(): string | null {
    if (!correo.includes('@') || correo.trim().length < 5) return 'Ese correo está incompleto.';
    if (!contrasena) return 'Falta la contraseña.';
    return null;
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const problema = revisar();
    setFallo(problema);
    if (problema) return;
    setAviso(null);
    setTrabajando('correo');
    try {
      await entrarConCorreo(correo, contrasena);
      /* El acierto se enseña antes de irse. Sin este medio segundo, pulsar y que la
         pantalla cambie de golpe se lee como un salto; con él, se lee como que ha
         funcionado. */
      setEntrado(true);
      setTimeout(() => router.replace('/'), 480);
    } catch {
      /* el mensaje ya viene traducido en `error` */
      setTrabajando(null);
    }
  }

  async function conGoogle() {
    setFallo(null);
    setAviso(null);
    setTrabajando('google');
    try {
      await entrarConGoogle();
      setEntrado(true);
      setTimeout(() => router.replace('/'), 480);
    } catch {
      setTrabajando(null);
    }
  }

  async function olvidada() {
    if (!correo.includes('@')) {
      setFallo('Escribe tu correo arriba y vuelve a pulsar.');
      primerCampo.current?.focus();
      return;
    }
    setFallo(null);
    limpiarError();
    setTrabajando('recuperar');
    try {
      await recuperar(correo);
      setAviso(`Te hemos mandado un correo a ${correo.trim()} para poner una contraseña nueva.`);
    } catch {
      /* idem */
    } finally {
      setTrabajando(null);
    }
  }

  const mensaje = fallo ?? error;
  const ocupado = trabajando !== null || entrado;

  return (
    <main className="acceso">
      <section className="acceso-panel">
        {/* ── la mitad dibujada ── */}
        <aside className="acceso-obra" aria-hidden="true">
          <Plano />
          <p className="acceso-lema">
            Todo tu curso en un sitio que
            <br />
            apetece abrir.
          </p>
        </aside>

        {/* ── la mitad del formulario ── */}
        <div className="acceso-caja">
          <Marca />

          {usuario ? (
            <YaDentro
              nombre={usuario.displayName ?? usuario.email ?? 'tu cuenta'}
              alSalir={salir}
              alEscritorio={() => router.replace('/')}
            />
          ) : (
            <>
              <header className="acceso-cab">
                <h1>Bienvenida de nuevo</h1>
                <p>Entra y recupera tu curso tal y como lo dejaste.</p>
              </header>

              <form className="acceso-form" onSubmit={enviar} noValidate>
                <div>
                  <Label htmlFor="correo">Correo</Label>
                  <Input
                    id="correo"
                    ref={primerCampo}
                    className="campo"
                    type="email"
                    inputMode="email"
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    placeholder="celeste@correo.com"
                    autoComplete="email"
                    disabled={ocupado}
                  />
                </div>

                <div>
                  <div className="acceso-fila-label">
                    <Label htmlFor="clave">Contraseña</Label>
                    <button type="button" className="acceso-enlace" onClick={olvidada} disabled={ocupado}>
                      {trabajando === 'recuperar' ? 'Enviando…' : '¿La has olvidado?'}
                    </button>
                  </div>
                  <div className="acceso-clave">
                    <Input
                      id="clave"
                      className="campo"
                      type={verClave ? 'text' : 'password'}
                      value={contrasena}
                      onChange={(e) => setContrasena(e.target.value)}
                      onKeyUp={mirarMayusculas}
                      onKeyDown={mirarMayusculas}
                      onBlur={() => setMayusculas(false)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      disabled={ocupado}
                    />
                    <button
                      type="button"
                      className="acceso-ojo"
                      onClick={() => setVerClave((v) => !v)}
                      aria-label={verClave ? 'Ocultar la contraseña' : 'Ver la contraseña'}
                      aria-pressed={verClave}
                      tabIndex={-1}
                    >
                      <Ojo abierto={verClave} />
                    </button>
                  </div>
                  <p className={`acceso-mayus${mayusculas ? ' on' : ''}`} aria-live="polite">
                    {/* Dos capas a propósito: la de fuera recorta, la de dentro lleva la
                        separación. Si el relleno fuera de la que recorta, se sumaría por
                        fuera de la altura cero y el aviso dejaría su hueco aun cerrado. */}
                    <span>
                      <span className="acceso-mayus-in">
                        <Candado />
                        Bloq Mayús está activado
                      </span>
                    </span>
                  </p>
                </div>

                {/* El sitio del mensaje está reservado siempre —una línea— para que un
                    aviso corto no empuje el botón justo cuando se va a pulsar. Si el
                    texto ocupa dos, el hueco crece con él: antes llevaba un margen
                    negativo para apretar el espacio vacío y eso hacía que un error largo
                    se montara literalmente encima del botón. */}
                <p
                  className={`acceso-msg${mensaje ? ' mal' : ''}${aviso && !mensaje ? ' bien' : ''}`}
                  role="status"
                  aria-live="polite"
                >
                  {mensaje ? <Alerta /> : null}
                  <span>{mensaje ?? aviso ?? ''}</span>
                </p>

                {/* El rótulo, el giro y el visto viven los tres a la vez y se turnan con
                    la opacidad: si se sustituyeran, el botón cambiaría de ancho en mitad
                    de la pulsación. */}
                <Button
                  type="submit"
                  className={`acceso-principal${entrado ? ' hecho' : ''}`}
                  disabled={ocupado || !hayCuentas}
                  aria-busy={trabajando === 'correo'}
                >
                  <span className="acceso-caras">
                    <span className={`acceso-cara${trabajando === 'correo' || entrado ? '' : ' on'}`}>Entrar</span>
                    <span className={`acceso-cara${trabajando === 'correo' ? ' on' : ''}`}>
                      <Girando />
                      Entrando
                    </span>
                    <span className={`acceso-cara${entrado ? ' on' : ''}`}>
                      <Visto />
                      Dentro
                    </span>
                  </span>
                </Button>
              </form>

              <div className="acceso-o">
                <span>o</span>
              </div>

              <Button
                type="button"
                variant="outline"
                className="acceso-google"
                onClick={conGoogle}
                disabled={ocupado || !hayCuentas}
              >
                {trabajando === 'google' ? <Girando /> : <LogoGoogle />}
                Continuar con Google
              </Button>

              {!hayCuentas && (
                <p className="acceso-nota">
                  Falta la configuración de Firebase en este equipo, así que de momento no se puede entrar.
                  Archicel funciona igual sin cuenta.
                </p>
              )}

              <Link href="/" className="acceso-sin">
                Seguir sin cuenta
                <Flechita />
              </Link>
            </>
          )}
        </div>
      </section>

      <Firma />
    </main>
  );
}

/* ───────────────────────── piezas ───────────────────────── */

/** Los dos triángulos: el mismo trazo que preside el raíl, sin reinventarlo. */
function Marca() {
  return (
    <div className="acceso-marca">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 20 12 4l9 16" />
        <path d="M7.5 20 12 11l4.5 9" />
      </svg>
      <span>Archicel</span>
    </div>
  );
}

/**
 * La mitad izquierda: los dos triángulos de Archicel, dibujándose.
 *
 * Antes había aquí una fotografía, y era **la misma** que sostiene la aplicación por
 * detrás. Puesta una encima de otra no se leía como una composición sino como un error
 * de recorte: la casa aparecía dos veces, a dos escalas y con dos revelados.
 *
 * Lo que la sustituye es la marca a tamaño de cartel sobre papel milimetrado, que es
 * donde vive una estudiante de arquitectura. El trazo se dibuja solo —el alzado aparece
 * como se dibuja de verdad, de una línea a la siguiente— y las cotas de los lados son las
 * que acompañan a cualquier alzado.
 */
function Plano() {
  return (
    <div className="plano">
      <span className="plano-rejilla" />
      <span className="plano-luz" />
      <svg className="plano-svg" viewBox="0 0 240 260" fill="none" aria-hidden="true">
        {/* las cotas: primero, tenues, como el encaje a lápiz antes del trazo firme */}
        <g className="plano-cotas" stroke="currentColor" strokeWidth=".9" strokeLinecap="round">
          <path d="M26 30v200M214 30v200" />
          <path d="M22 30h8M22 230h8M210 30h8M210 230h8" />
          <path d="M26 246h188M26 242v8M214 242v8" />
        </g>

        {/* el suelo */}
        <path className="plano-suelo" d="M8 230h224" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />

        {/* los dos triángulos, a escala de alzado */}
        <g className="plano-marca" stroke="url(#plano-trazo)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M40 230 120 88l80 142" />
          <path d="M80 230l40-80 40 80" />
        </g>

        <defs>
          <linearGradient id="plano-trazo" gradientUnits="userSpaceOnUse" x1="40" y1="88" x2="200" y2="230">
            <stop offset="0%" stopColor="#D8E6FC" />
            <stop offset="52%" stopColor="#8FB6F2" />
            <stop offset="100%" stopColor="#4C82D8" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

function YaDentro({
  nombre,
  alSalir,
  alEscritorio,
}: {
  nombre: string;
  alSalir: () => Promise<void>;
  alEscritorio: () => void;
}) {
  return (
    <>
      <header className="acceso-cab">
        <h1>Ya estás dentro</h1>
        <p>
          Esta sesión es de <b>{nombre}</b>. Tus cosas se guardan en la nube y te siguen a cualquier dispositivo.
        </p>
      </header>
      <div className="acceso-form">
        <Button type="button" className="acceso-principal" onClick={alEscritorio}>
          <span className="acceso-caras">
            <span className="acceso-cara on">Ir al escritorio</span>
          </span>
        </Button>
        <Button type="button" variant="outline" className="acceso-google" onClick={alSalir}>
          Cerrar sesión
        </Button>
      </div>
    </>
  );
}

function Ojo({ abierto }: { abierto: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
      {!abierto && <path d="M4 20 20 4" />}
    </svg>
  );
}

function Alerta() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.6v5M12 16.2h.01" />
    </svg>
  );
}

function Candado() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.6" />
      <path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7" />
    </svg>
  );
}

function Flechita() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h13M12.5 6l5.5 6-5.5 6" />
    </svg>
  );
}

/** El único logotipo ajeno de la aplicación; va en sus colores porque si no, no se reconoce. */
function LogoGoogle() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21.6 12.23c0-.67-.06-1.31-.17-1.93H12v3.65h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.89-1.75 2.98-4.32 2.98-7.25z" fill="#4285F4" />
      <path d="M12 22c2.7 0 4.96-.9 6.62-2.42l-3.24-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.06v2.59A10 10 0 0 0 12 22z" fill="#34A853" />
      <path d="M6.41 13.91a6 6 0 0 1 0-3.82V7.5H3.06a10 10 0 0 0 0 9l3.35-2.59z" fill="#FBBC05" />
      <path d="M12 5.98c1.47 0 2.79.5 3.82 1.5l2.87-2.87C16.95 2.99 14.7 2 12 2a10 10 0 0 0-8.94 5.5l3.35 2.59C7.2 7.73 9.4 5.98 12 5.98z" fill="#EA4335" />
    </svg>
  );
}

function Girando() {
  return (
    <svg className="acceso-girando" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".28" strokeWidth="2.2" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function Visto() {
  return (
    <svg className="acceso-visto" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  );
}
