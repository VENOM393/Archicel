'use client';

/**
 * El avatar de la cabecera, con lo que hay detrás.
 *
 * Antes era una pastilla con dos letras que no hacía nada. Ahora contesta a las dos
 * preguntas que de verdad se hacen al mirar ahí: **quién soy** y **dónde están mis
 * cosas**. La segunda importa más de lo que parece en una aplicación que funciona con
 * cuenta y sin ella: sin decirlo, no hay forma de saber si lo de hoy estará mañana en el
 * portátil de al lado.
 *
 * No hay redirección a la pantalla de acceso desde aquí ni desde ningún sitio: entrar es
 * una invitación que se acepta cuando apetece, y este menú es donde vive.
 */

import { useState } from 'react';
import Link from 'next/link';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FALTA_CONFIGURAR_ADMIN, NOMBRE_ROL } from '@/lib/auth/roles';
import { useArchicel } from '@/lib/firebase/sesion';

const USUARIA = 'Celeste';

/** Dos letras: iniciales del nombre si lo hay, y si no las de la usuaria de la casa. */
function iniciales(nombre: string | null | undefined): string {
  const limpio = (nombre ?? '').trim();
  if (!limpio) return USUARIA.slice(0, 2).toUpperCase();
  const partes = limpio.split(/\s+/);
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  return limpio.slice(0, 2).toUpperCase();
}

export function MenuCuenta() {
  const { usuario, cargando, enLaNube, hayCuentas, rol, esAdmin, salir } = useArchicel();
  const nombre = usuario?.displayName ?? usuario?.email ?? null;
  const [copiado, setCopiado] = useState(false);
  /* Abierto a mano porque el menú vive en el marco y no se desmonta al navegar: sin
     cerrarlo, pulsar «Ajustes» cambiaba de página con el menú todavía encima. */
  const [abierto, setAbierto] = useState(false);

  async function copiarId() {
    if (!usuario) return;
    try {
      await navigator.clipboard.writeText(usuario.uid);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      /* sin portapapeles queda el identificador a la vista para copiarlo a mano */
    }
  }

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger className="avatar" aria-label="Tu cuenta">
        {/* La foto de Google cuando la hay; las iniciales cuando no. Nunca las dos. */}
        {usuario?.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={usuario.photoURL} alt="" referrerPolicy="no-referrer" />
        ) : (
          iniciales(nombre)
        )}
        <span className={`avatar-punto${enLaNube ? ' nube' : ''}`} aria-hidden="true" />
      </PopoverTrigger>

      <PopoverContent className="cuenta-caja" align="end" sideOffset={10}>
        <div className="cuenta-quien">
          <b>
            {nombre ?? USUARIA}
            {esAdmin && <i className="cuenta-rol">{NOMBRE_ROL.admin}</i>}
          </b>
          <span>{usuario ? (usuario.email ?? 'Sesión iniciada') : 'Sin cuenta en este equipo'}</span>
        </div>

        <p className="cuenta-donde">
          <span className={`cuenta-pt${enLaNube ? ' nube' : ''}`} aria-hidden="true" />
          {enLaNube
            ? 'Tus cosas se guardan en la nube y en este equipo.'
            : 'Tus cosas se guardan solo en este equipo.'}
        </p>

        {/* Mientras no haya ningún administrador configurado, el menú ofrece el
            identificador de quien esté dentro: es el único momento en que hace falta
            verlo, y este trozo desaparece solo en cuanto la lista de `roles.ts` deja de
            estar vacía. Un ajuste que se esconde cuando ya no sirve es mejor que un
            ajuste permanente. */}
        {usuario && FALTA_CONFIGURAR_ADMIN && (
          <div className="cuenta-id">
            <span>Tu identificador</span>
            <button type="button" onClick={copiarId} title="Copiar">
              <code>{usuario.uid}</code>
              {copiado ? <Visto /> : <Copiar />}
            </button>
            <small>Pégalo en {'src/lib/auth/roles.ts'} y en {'firestore.rules'} para ser administrador.</small>
          </div>
        )}

        <hr />

        <div className="cuenta-acciones">
          {/* Aquí está la conexión con Google Drive: con qué cuenta, y cómo soltarla. */}
          <Link href="/ajustes" className="cuenta-accion" onClick={() => setAbierto(false)}>
            Ajustes
            <Deslizadores />
          </Link>

          {usuario ? (
            <button type="button" className="cuenta-accion" onClick={salir}>
              Cerrar sesión
              <Salida />
            </button>
          ) : (
            <Link href="/entrar" className="cuenta-accion destacada">
              {hayCuentas ? 'Entrar con tu cuenta' : 'Ver el acceso'}
              <Flecha />
            </Link>
          )}
        </div>

        {!usuario && hayCuentas && (
          <p className="cuenta-pie">
            Al entrar, lo que ya tienes guardado aquí sube solo. No se pierde nada.
          </p>
        )}
        {cargando && <p className="cuenta-pie">Comprobando la sesión…</p>}
      </PopoverContent>
    </Popover>
  );
}

function Flecha() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h13M12.5 6l5.5 6-5.5 6" />
    </svg>
  );
}

function Copiar() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2.4" />
      <path d="M15 5.5A2.5 2.5 0 0 0 12.5 3h-7A2.5 2.5 0 0 0 3 5.5v7A2.5 2.5 0 0 0 5.5 15" />
    </svg>
  );
}

function Visto() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  );
}

function Deslizadores() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </svg>
  );
}

function Salida() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 4h3.5A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5H14" />
      <path d="M10 8.5 6.5 12 10 15.5M6.5 12H16" />
    </svg>
  );
}
