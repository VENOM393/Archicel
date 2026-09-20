/**
 * De dónde salen las llaves de Canvas.
 *
 * **Ninguna de estas variables lleva el prefijo `NEXT_PUBLIC_`, y eso no es un descuido.**
 * Un token personal de Canvas puede hacer todo lo que puede hacer su dueña: leer notas y
 * mensajes, entregar trabajos y borrarlos. No existen permisos parciales. Si el prefijo
 * estuviera ahí, Next lo incrustaría en el JavaScript que descarga el navegador y el
 * token sería público para siempre.
 *
 * Por eso este fichero **solo se puede importar desde código de servidor**. Si alguna vez
 * aparece en un componente con `'use client'`, el fallo es de arquitectura, no de aquí.
 *
 * Qué poner en `.env.local` (que está en `.gitignore` y ahí se queda):
 *
 *     CANVAS_URL=https://canvas.ucam.edu
 *     CANVAS_TOKEN=...   ← Canvas → Cuenta → Configuración → Nuevo token de acceso
 *     CANVAS_ZONA=Europe/Madrid
 */

/** El campus. Sin barra final: las rutas se pegan detrás. */
export const CANVAS_URL = (process.env.CANVAS_URL ?? 'https://canvas.ucam.edu').replace(/\/+$/, '');

export const CANVAS_TOKEN = process.env.CANVAS_TOKEN ?? '';

/**
 * La zona horaria con la que se leen las fechas de Canvas.
 *
 * Canvas devuelve instantes en UTC (`2026-09-20T21:59:00Z`). Una entrega que vence a las
 * 23:59 de Madrid llega como las 21:59 del mismo día en verano — pero en invierno, una
 * que vence a las 00:30 llegaría como las 23:30 **del día anterior**. Convertir con la
 * zona del servidor sería correcto solo por casualidad; con la del campus lo es siempre.
 */
export const CANVAS_ZONA = process.env.CANVAS_ZONA ?? 'Europe/Madrid';

/** Hay con qué llamar. Sin esto, el motor no lo intenta siquiera. */
export const hayCanvas = CANVAS_TOKEN.length > 0;
