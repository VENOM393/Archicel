import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  /**
   * Cuánto conserva el navegador una ruta ya visitada antes de volver a pedirla.
   *
   * Las cinco rutas de Archicel son estáticas: su HTML no depende de quién entre, porque
   * todo lo que cambia —tareas, eventos, layout— llega después por Firestore en el
   * cliente. Con el valor por defecto, el router las tiraba enseguida y el primer clic
   * tras la caducidad iba al servidor: medido, la diferencia era 85 ms contra 1030 ms
   * yendo al calendario. Guardarlas tres minutos no puede servir nada desactualizado,
   * porque en ese HTML no hay datos.
   */
  experimental: {
    staleTimes: {
      static: 180,
      dynamic: 30,
    },
  },

  /**
   * Cabeceras de seguridad.
   *
   * La aplicación es de una sola usuaria y todo el acceso a datos lo controlan las
   * reglas de Firestore, pero estas cabeceras cierran las vías que no dependen de la
   * autenticación: que otra web la embeba para engañar a quien pulsa, que el navegador
   * adivine tipos de contenido, o que la URL de Archicel viaje a terceros al salir.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          /* nadie puede meter Archicel en un iframe: evita el clickjacking */
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          /* el navegador respeta el tipo declarado y no lo adivina */
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          /* al salir a otro sitio no se filtra la ruta que estaba abierta */
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          /* no se usa ninguna de estas capacidades: se renuncia a ellas explícitamente */
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
