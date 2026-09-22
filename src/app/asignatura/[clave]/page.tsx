import { notFound } from 'next/navigation';

import { Asignatura } from '@/components/Asignatura';
import { CLAVES_ASIGNATURA, type ClaveAsignatura } from '@/lib/data';

/**
 * Las seis páginas se generan en la construcción.
 *
 * El catálogo del curso es estático —vive en `curso.ts` y cambia una vez por
 * cuatrimestre—, así que no hay ningún motivo para pedirle al servidor que las arme una a
 * una. Salen del `build` como salen el escritorio y el horario.
 */
export function generateStaticParams() {
  return CLAVES_ASIGNATURA.map((clave) => ({ clave }));
}

export const dynamicParams = false;

export default async function PaginaAsignatura({ params }: { params: Promise<{ clave: string }> }) {
  const { clave } = await params;
  /* Una clave inventada en la barra de direcciones no se pinta a medias: es un 404. */
  if (!(CLAVES_ASIGNATURA as string[]).includes(clave)) notFound();
  return <Asignatura clave={clave as ClaveAsignatura} />;
}
