import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sin `experimental.serverActions.bodySizeLimit`: esta aplicación no usa
  // Server Actions —las subidas van a Route Handlers (POST /api/…), que no
  // tienen ese límite— así que ajustarlo no hacía nada. El tope real de 50 MB
  // lo comprueban las propias rutas.
  //
  // Las cabeceras de caché las pone `src/proxy.ts`, no aquí: definirlas para
  // `/_next/static/(.*)` hacía que el build avisara de que puede romper el
  // comportamiento de Next, que ya sirve esos ficheros como inmutables por su
  // cuenta. `X-Content-Type-Options` viene además del borde para todo el
  // dominio.

  // Fija la raíz del proyecto a este directorio. Sin esto, un `package-lock.json`
  // suelto más arriba en el árbol (hay uno en el home) hace que Next infiera una
  // raíz equivocada y avise en cada build.
  turbopack: {
    // Absoluta: Next avisa si es relativa ("turbopack.root should be absolute").
    root: import.meta.dirname,
  },
};

export default nextConfig;