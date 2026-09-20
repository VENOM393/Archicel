'use client';

/**
 * El motor del escritorio: dónde está cada widget, cómo se arrastra y dónde se guarda.
 *
 * Las posiciones se leen y escriben por el almacén, así que la misma disposición sigue a
 * Celeste entre dispositivos en cuanto hay sesión. Se escriben en el acto —sin retardos
 * que puedan perderse— y siempre con copia en este equipo: lo coloca a mano, bloque a
 * bloque, y es lo único que no se puede volver a escribir de memoria.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useArchicel } from '@/lib/firebase/sesion';
import type { Caja, Layout } from '@/lib/data';
import { IMAN, WIDGETS, fusionarLayout, layoutPorDefecto, minimoEnPixeles } from '@/lib/widgets/registro';

type Guia = { v: number | null; h: number | null };

/**
 * La última disposición resuelta, fuera de React.
 *
 * El escritorio se desmonta al ir al calendario y se vuelve a montar al volver. Sin esta
 * memoria, cada regreso empezaba por las posiciones de fábrica y corregía en el
 * fotograma siguiente: se veían los bloques con su tamaño estándar y pegaban el salto a
 * su sitio. El almacén responde rápido, pero nunca lo bastante para el primer pintado.
 *
 * Vive a nivel de módulo a propósito: tiene que sobrevivir al desmontaje, que es
 * justamente lo que el estado de React no hace. Está vacía durante el renderizado en
 * servidor y en la hidratación —ahí no ha habido ningún montaje previo—, así que el
 * primer pintado del servidor y el del navegador siguen coincidiendo.
 */
const memoria = new Map<string, Layout>();

export function useEscritorio(lienzo: React.RefObject<HTMLDivElement | null>, editando: boolean) {
  const { almacen } = useArchicel();
  const clave = `${almacen.uid}:escritorio`;
  const [layout, setLayout] = useState<Layout>(() => memoria.get(clave) ?? layoutPorDefecto());
  const [guias, setGuias] = useState<Guia>({ v: null, h: null });
  /* Si ya se sabe dónde va cada cosa, se puede pintar en el primer fotograma. */
  const [listo, setListo] = useState(() => memoria.has(clave));
  const zTop = useRef(10);

  /* carga inicial y escucha: si cambia en otro dispositivo, aquí se entera */
  useEffect(() => {
    const doc = almacen.layout('escritorio');
    let primero = true;
    const off = doc.escuchar((valor) => {
      const fusion = fusionarLayout(valor);
      memoria.set(clave, fusion);
      setLayout(fusion);
      if (primero) {
        primero = false;
        setListo(true);
      }
    });
    return off;
  }, [almacen, clave]);

  /**
   * Se guarda en el acto, sin retardo.
   *
   * Antes esperaba 400 ms "para no mandar un documento por cada píxel arrastrado", pero
   * el arrastre mueve el nodo del DOM directamente y solo llama aquí **al soltar**: no
   * había ninguna avalancha que amortiguar. Lo único que conseguía el retardo era abrir
   * una ventana de 400 ms en la que recargar o cambiar de página perdía el último
   * cambio. Y esa ventana caía justo después de mover algo, que es cuando uno mira si
   * quedó bien y recarga.
   */
  const guardar = useCallback(
    (siguiente: Layout) => {
      almacen
        .layout('escritorio')
        .escribir(siguiente)
        .catch(() => {
          /* El espejo local ya lo tiene; esto solo puede ser la nube, y de eso avisa
             `registrarAvisoDeFallo` una sola vez en lugar de en cada escritura. */
        });
    },
    [almacen],
  );

  const aplicar = useCallback(
    (siguiente: Layout) => {
      /* La memoria se actualiza aquí y no al confirmar el guardado: al volver de otra
         vista, el bloque tiene que estar donde se dejó aunque la nube todavía no haya
         contestado. */
      memoria.set(clave, siguiente);
      setLayout(siguiente);
      guardar(siguiente);
    },
    [guardar, clave],
  );

  const anchoLienzo = useCallback(() => lienzo.current?.getBoundingClientRect().width ?? 1, [lienzo]);

  const rectDe = useCallback(
    (id: string, l = layout): { l: number; t: number; r: number; b: number } => {
      const W = anchoLienzo();
      const c = l[id];
      return { l: c.fx * W, t: c.y, r: c.fx * W + c.fw * W, b: c.y + c.h };
    },
    [layout, anchoLienzo],
  );

  /** Imanta a los bordes de los vecinos, al centro y a los extremos. Con Alt, libertad total. */
  const imantar = useCallback(
    (id: string, l: number, t: number, w: number, h: number, libre: boolean) => {
      if (libre) return { l, t, gv: null as number | null, gh: null as number | null };
      const W = anchoLienzo();
      const candX = [0, W / 2 - w / 2, W - w];
      const candY = [0];
      WIDGETS.forEach((def) => {
        if (def.id === id) return;
        const r = rectDe(def.id);
        candX.push(r.l, r.r, r.r - w, r.l - w);
        candY.push(r.t, r.b, r.b - h, r.t - h);
      });
      let nl = l;
      let nt = t;
      let gv: number | null = null;
      let gh: number | null = null;
      candX.forEach((c) => {
        if (gv === null && Math.abs(l - c) <= IMAN) {
          nl = c;
          gv = c;
        }
      });
      candY.forEach((c) => {
        if (gh === null && Math.abs(t - c) <= IMAN) {
          nt = c;
          gh = c;
        }
      });
      return { l: nl, t: nt, gv, gh };
    },
    [anchoLienzo, rectDe],
  );

  const empezarArrastre = useCallback(
    (ev: React.PointerEvent, id: string) => {
      if (!editando || ev.button > 0) return;
      const nodo = (ev.currentTarget as HTMLElement);
      const caja = layout[id];
      const W = anchoLienzo();
      const rl = lienzo.current!.getBoundingClientRect();
      const offX = ev.clientX - (rl.left + caja.fx * W);
      const offY = ev.clientY - (rl.top + caja.y);
      const w = caja.fw * W;
      const h = caja.h;
      let ultimo: Caja = caja;

      nodo.classList.add('dragging');
      nodo.style.zIndex = String(++zTop.current);
      try {
        nodo.setPointerCapture(ev.pointerId);
      } catch {}

      const mover = (e: PointerEvent) => {
        let l = e.clientX - rl.left - offX;
        let t = Math.max(0, e.clientY - rl.top - offY);
        l = Math.min(Math.max(l, -w * 0.25), W - w * 0.75);
        const im = imantar(id, l, t, w, h, e.altKey);
        nodo.style.left = `${im.l}px`;
        nodo.style.top = `${im.t}px`;
        setGuias({ v: im.gv, h: im.gh });
        ultimo = { fx: im.l / W, fw: caja.fw, y: im.t, h: caja.h };
      };
      const soltar = () => {
        window.removeEventListener('pointermove', mover);
        window.removeEventListener('pointerup', soltar);
        nodo.classList.remove('dragging');
        setGuias({ v: null, h: null });
        aplicar({ ...layout, [id]: ultimo });
      };
      window.addEventListener('pointermove', mover);
      window.addEventListener('pointerup', soltar);
    },
    [editando, layout, anchoLienzo, lienzo, imantar, aplicar],
  );

  const empezarResize = useCallback(
    (ev: React.PointerEvent, id: string) => {
      if (!editando) return;
      ev.stopPropagation();
      const nodo = (ev.currentTarget as HTMLElement).closest('.widget') as HTMLElement;
      const def = WIDGETS.find((d) => d.id === id)!;
      const min = minimoEnPixeles(def);
      const caja = layout[id];
      const W = anchoLienzo();
      const x0 = ev.clientX;
      const y0 = ev.clientY;
      const w0 = caja.fw * W;
      const h0 = caja.h;
      const l0 = caja.fx * W;
      let ultimo: Caja = caja;
      nodo.classList.add('dragging');
      nodo.style.zIndex = String(++zTop.current);

      const mover = (e: PointerEvent) => {
        let w = Math.min(Math.max(w0 + (e.clientX - x0), min.w), W - l0);
        let h = Math.max(min.h, h0 + (e.clientY - y0));
        if (!e.altKey) {
          WIDGETS.forEach((otro) => {
            if (otro.id === id) return;
            const r = rectDe(otro.id);
            if (Math.abs(l0 + w - r.l) <= IMAN) w = r.l - l0;
            if (Math.abs(l0 + w - r.r) <= IMAN) w = r.r - l0;
            if (Math.abs(caja.y + h - r.t) <= IMAN) h = r.t - caja.y;
            if (Math.abs(caja.y + h - r.b) <= IMAN) h = r.b - caja.y;
          });
        }
        nodo.style.width = `${w}px`;
        nodo.style.height = `${h}px`;
        ultimo = { fx: caja.fx, fw: w / W, y: caja.y, h };
      };
      const soltar = () => {
        window.removeEventListener('pointermove', mover);
        window.removeEventListener('pointerup', soltar);
        nodo.classList.remove('dragging');
        aplicar({ ...layout, [id]: ultimo });
      };
      window.addEventListener('pointermove', mover);
      window.addEventListener('pointerup', soltar);
    },
    [editando, layout, anchoLienzo, rectDe, aplicar],
  );

  const cambiarAncho = useCallback(
    (id: string, fw: number) => {
      const caja = layout[id];
      aplicar({ ...layout, [id]: { ...caja, fw, fx: Math.min(caja.fx, 1 - fw) } });
    },
    [layout, aplicar],
  );

  const alFrente = useCallback((id: string) => {
    const nodo = document.querySelector<HTMLElement>(`.widget[data-id="${id}"]`);
    if (nodo) nodo.style.zIndex = String(++zTop.current);
  }, []);

  /** Quita o pone el marco de un widget. */
  const alternarMarco = useCallback(
    (id: string) => {
      const caja = layout[id];
      aplicar({ ...layout, [id]: { ...caja, desnudo: !caja.desnudo } });
    },
    [layout, aplicar],
  );

  /** Quita o pone el marco de todos a la vez. */
  const alternarMarcoTodos = useCallback(() => {
    const algunoConMarco = Object.values(layout).some((c) => !c.desnudo);
    const siguiente: Layout = {};
    Object.entries(layout).forEach(([k, c]) => {
      siguiente[k] = { ...c, desnudo: algunoConMarco };
    });
    aplicar(siguiente);
    return algunoConMarco;
  }, [layout, aplicar]);

  const restablecer = useCallback(() => aplicar(layoutPorDefecto()), [aplicar]);

  const restablecerUno = useCallback(
    (id: string) => {
      const def = WIDGETS.find((d) => d.id === id)!;
      aplicar({ ...layout, [id]: fusionarLayout(null)[def.id] });
    },
    [layout, aplicar],
  );

  /* Solo cuentan los que se pintan: el layout puede guardar cajas de widgets retirados
     —se conservan para cuando vuelvan— y esas no deben estirar el lienzo ni ocupar un
     turno en la entrada. */
  const visibles = WIDGETS.map((w) => [w.id, layout[w.id]] as const).filter(([, c]) => Boolean(c));

  const altoLienzo = visibles.reduce((max, [, c]) => Math.max(max, c.y + c.h), 0) + 24;

  /**
   * En qué orden se posan los widgets al entrar: como se lee la página, por filas de
   * arriba abajo y dentro de cada fila de izquierda a derecha. Se agrupa por bandas de
   * 60 px para que dos paneles alineados a ojo entren juntos aunque difieran un píxel.
   */
  const orden: Record<string, number> = {};
  [...visibles]
    .sort(([, a], [, b]) => Math.floor(a.y / 60) - Math.floor(b.y / 60) || a.fx - b.fx)
    .forEach(([id], i) => {
      orden[id] = i;
    });

  return {
    layout,
    listo,
    guias,
    orden,
    altoLienzo,
    empezarArrastre,
    empezarResize,
    cambiarAncho,
    alternarMarco,
    alternarMarcoTodos,
    alFrente,
    restablecer,
    restablecerUno,
  };
}
