// Criterio de diseño único para toda la app -- pensado para no tener que
// re-auditar esto cada vez que se arma una pantalla nueva. No son reglas
// inventadas: son lo que ya era el estándar de facto en la mayoría de las
// pantallas (auditoría: 6 de 7 páginas de primer nivel ya compartían el
// mismo wrapper, y 768px era el único breakpoint mobile/desktop usado en
// todo el repo) -- esto lo deja explícito y con un solo lugar para
// cambiarlo si hace falta más adelante.

// Wrapper estándar de toda página de primer nivel (una por entrada del
// Sidebar, ver accessControl.ts). `ProyectosPage.tsx` era la única
// excepción antes de esto (max-w-5xl, sin animate-fade-in, otro padding).
export const PAGE_CONTAINER_CLASS = 'p-3 sm:p-5 md:p-8 space-y-4 sm:space-y-5 max-w-7xl mx-auto animate-fade-in';

// Único breakpoint mobile/desktop de la app -- usar siempre
// useMediaQuery(BREAKPOINT_DESKTOP) en vez de inventar un pixel nuevo. Por
// debajo de esto, una lista se muestra como tarjetas apiladas; desde acá
// para arriba, como tabla.
export const BREAKPOINT_DESKTOP = '(min-width: 768px)';

// Tablas: llenan el ancho disponible del contenedor -- w-full, SIN
// min-w-[Npx] (eso las dimensiona por contenido, no por el espacio real
// de la página, y fuerza scroll horizontal en vez de aprovechar el
// ancho). Texto largo trunca (className="truncate", + atributo title con
// el valor completo) en vez de forzar ese scroll. table-fixed para que
// las columnas no salten de ancho al filtrar/paginar.
export const TABLE_CLASS = 'w-full table-fixed text-xs';
