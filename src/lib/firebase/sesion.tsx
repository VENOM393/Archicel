'use client';

/**
 * Quién está usando la app.
 *
 * Expone el almacén ya resuelto: la interfaz pide `useArchicel()` y recibe los datos
 * del sitio que toque, sin enterarse de si hay sesión o no.
 *
 * ## Aquí no se crean cuentas
 *
 * Se dan de alta en la consola de Firebase y ya está. Archicel tiene dos, conocidas, y un
 * formulario de alta en una aplicación privada no es una comodidad: es una puerta que no
 * tendría por qué existir.
 *
 * ## La cuenta es una invitación, no un muro
 *
 * Archicel funciona entera sin cuenta, contra el navegador. Entrar no desbloquea nada:
 * lo que hace es que el escritorio, las tareas y el calendario la sigan a cualquier
 * dispositivo. Por eso no hay redirección forzada a la pantalla de acceso y por eso, al
 * entrar por primera vez, lo que ya hubiera guardado en este equipo sube solo.
 *
 * La consecuencia técnica importa: si Firebase está caído, mal configurado o sin red, la
 * aplicación **abre igual**. Un muro habría convertido cualquier fallo de la nube en una
 * aplicación que no arranca.
 */

import {
  GoogleAuthProvider, onAuthStateChanged, sendPasswordResetEmail,
  signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, signOut,
  type User,
} from 'firebase/auth';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { getAuthCliente, hayFirebase } from './config';
import { mensajeDeError } from './errores';
import { crearAlmacen, migrarLocalANube, type Almacen } from '@/lib/data';
import { esAdmin as calcularAdmin, rolDe, type Rol } from '@/lib/auth/roles';

interface Sesion {
  usuario: User | null;
  cargando: boolean;
  almacen: Almacen;
  enLaNube: boolean;
  /** Se puede intentar entrar: hay configuración de Firebase. */
  hayCuentas: boolean;
  /**
   * El papel de quien está dentro.
   *
   * Es para decidir **qué se enseña**, nunca para proteger nada: esto se calcula en el
   * navegador y cualquiera puede cambiarlo desde el navegador. Quien impide de verdad
   * leer datos ajenos es `firestore.rules`.
   */
  rol: Rol;
  esAdmin: boolean;
  entrarConGoogle: () => Promise<void>;
  entrarConCorreo: (correo: string, contrasena: string) => Promise<void>;
  recuperar: (correo: string) => Promise<void>;
  salir: () => Promise<void>;
  error: string | null;
  limpiarError: () => void;
}

const Ctx = createContext<Sesion | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [cargando, setCargando] = useState(hayFirebase);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auth = getAuthCliente();
    if (!auth) {
      setCargando(false);
      return;
    }
    return onAuthStateChanged(
      auth,
      (u) => {
        setUsuario(u);
        setCargando(false);
        /* Lo que hubiera en este equipo sube a la nube la primera vez, y solo la primera:
           `migrarLocalANube` deja su marca para no duplicar nada en el siguiente arranque. */
        if (u) migrarLocalANube(u.uid).catch(() => {});
      },
      (e) => {
        setError(mensajeDeError(e));
        setCargando(false);
      },
    );
  }, []);

  const almacen = useMemo(() => crearAlmacen(usuario?.uid ?? null), [usuario?.uid]);

  const limpiarError = useCallback(() => setError(null), []);

  /**
   * Envuelve cada intento: limpia el error anterior, traduce el nuevo y lo relanza.
   *
   * Lo relanza a propósito. El contexto guarda el mensaje para quien quiera pintarlo en
   * su sitio, pero la pantalla que hizo la llamada necesita saber que falló para no
   * apagar su estado de carga ni dar por buena una entrada que no ocurrió.
   */
  const intentar = useCallback(async (accion: () => Promise<unknown>) => {
    setError(null);
    try {
      await accion();
    } catch (e) {
      setError(mensajeDeError(e));
      throw e;
    }
  }, []);

  const entrarConGoogle = useCallback(
    () =>
      intentar(async () => {
        const auth = getAuthCliente();
        if (!auth) throw new Error('sin configuración');
        try {
          await signInWithPopup(auth, new GoogleAuthProvider());
        } catch (e) {
          /* Hay navegadores y modos —móvil en modo escritorio, privacidad estricta— que
             matan la ventana emergente. En ese caso se entra por redirección, que sale de
             la página y vuelve ya con sesión; para quien entra es lo mismo. */
          const codigo = (e as { code?: string }).code ?? '';
          if (codigo === 'auth/popup-blocked' || codigo === 'auth/operation-not-supported-in-this-environment') {
            await signInWithRedirect(auth, new GoogleAuthProvider());
            return;
          }
          throw e;
        }
      }),
    [intentar],
  );

  const entrarConCorreo = useCallback(
    (correo: string, contrasena: string) =>
      intentar(async () => {
        const auth = getAuthCliente();
        if (!auth) throw new Error('sin configuración');
        await signInWithEmailAndPassword(auth, correo.trim(), contrasena);
      }),
    [intentar],
  );


  const recuperar = useCallback(
    (correo: string) =>
      intentar(async () => {
        const auth = getAuthCliente();
        if (!auth) throw new Error('sin configuración');
        await sendPasswordResetEmail(auth, correo.trim());
      }),
    [intentar],
  );

  const salir = useCallback(async () => {
    const auth = getAuthCliente();
    if (auth) await signOut(auth);
  }, []);

  const valor: Sesion = {
    usuario,
    cargando,
    almacen,
    enLaNube: Boolean(usuario) && hayFirebase,
    rol: rolDe(usuario?.uid),
    esAdmin: calcularAdmin(usuario?.uid),
    hayCuentas: hayFirebase,
    entrarConGoogle,
    entrarConCorreo,
    recuperar,
    salir,
    error,
    limpiarError,
  };

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useArchicel(): Sesion {
  const v = useContext(Ctx);
  if (!v) throw new Error('useArchicel necesita estar dentro de <ProveedorSesion>');
  return v;
}
