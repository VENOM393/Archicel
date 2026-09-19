'use client';

/**
 * El estado de la interfaz que comparten todas las vistas: ambiente, modo edición,
 * opacidad de los bloques, la onda del fondo y los avisos.
 *
 * Vive por encima del enrutador para que el shader no se reinicie al cambiar de vista:
 * navegar entre escritorio, calendario y día no vuelve a compilar nada.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import type { MandoFondo } from '@/components/Fondo';

interface UI {
  dia: boolean;
  alternarAmbiente: () => void;
  editando: boolean;
  setEditando: (v: boolean) => void;
  opacidad: number;
  setOpacidad: (v: number) => void;
  aviso: string | null;
  avisar: (texto: string) => void;
  mandoFondo: React.MutableRefObject<MandoFondo | null>;
  onda: (x: number, y: number) => void;
}

const Ctx = createContext<UI | null>(null);
const CLAVE_OPACIDAD = 'archicel.opacidad.v1';

export function ProveedorUI({ children }: { children: ReactNode }) {
  const [dia, setDia] = useState(false);
  const [editando, setEditando] = useState(false);
  const [opacidad, setOpacidadEstado] = useState(70);
  const [aviso, setAviso] = useState<string | null>(null);
  const mandoFondo = useRef<MandoFondo | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* la opacidad es una preferencia del dispositivo, no del expediente: se queda aquí */
  useEffect(() => {
    try {
      const g = Number(localStorage.getItem(CLAVE_OPACIDAD));
      if (!Number.isNaN(g) && g > 0) setOpacidadEstado(g);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--opa', (opacidad / 100).toFixed(3));
    document.body.dataset.translucido = opacidad < 35 ? '1' : '0';
  }, [opacidad]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dia ? 'light' : 'dark');
  }, [dia]);

  useEffect(() => {
    document.body.classList.toggle('editing', editando);
  }, [editando]);

  const setOpacidad = useCallback((v: number) => {
    setOpacidadEstado(v);
    try {
      localStorage.setItem(CLAVE_OPACIDAD, String(v));
    } catch {}
  }, []);

  const avisar = useCallback((texto: string) => {
    setAviso(texto);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setAviso(null), 2200);
  }, []);

  const onda = useCallback((x: number, y: number) => mandoFondo.current?.onda(x, y), []);

  return (
    <Ctx.Provider
      value={{
        dia,
        alternarAmbiente: () => setDia((v) => !v),
        editando,
        setEditando,
        opacidad,
        setOpacidad,
        aviso,
        avisar,
        mandoFondo,
        onda,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useUI(): UI {
  const v = useContext(Ctx);
  if (!v) throw new Error('useUI necesita estar dentro de <ProveedorUI>');
  return v;
}
