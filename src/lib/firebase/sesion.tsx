'use client';

/**
 * Quién está usando la app.
 *
 * Expone el almacén ya resuelto: la interfaz pide `useArchicel()` y recibe los datos
 * del sitio que toque, sin enterarse de si hay sesión o no.
 */

import {
  GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut,
  type User,
} from 'firebase/auth';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { getAuthCliente, hayFirebase } from './config';
import { crearAlmacen, migrarLocalANube, type Almacen } from '@/lib/data';

interface Sesion {
  usuario: User | null;
  cargando: boolean;
  almacen: Almacen;
  enLaNube: boolean;
  entrar: () => Promise<void>;
  salir: () => Promise<void>;
  error: string | null;
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
        if (u) migrarLocalANube(u.uid).catch(() => {});
      },
      (e) => {
        setError(e.message);
        setCargando(false);
      },
    );
  }, []);

  const almacen = useMemo(() => crearAlmacen(usuario?.uid ?? null), [usuario?.uid]);

  const valor: Sesion = {
    usuario,
    cargando,
    almacen,
    enLaNube: Boolean(usuario) && hayFirebase,
    error,
    async entrar() {
      const auth = getAuthCliente();
      if (!auth) {
        setError('Falta la configuración de Firebase');
        return;
      }
      try {
        setError(null);
        await signInWithPopup(auth, new GoogleAuthProvider());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo entrar');
      }
    },
    async salir() {
      const auth = getAuthCliente();
      if (auth) await signOut(auth);
    },
  };

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useArchicel(): Sesion {
  const v = useContext(Ctx);
  if (!v) throw new Error('useArchicel necesita estar dentro de <ProveedorSesion>');
  return v;
}
