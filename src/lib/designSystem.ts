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
//
// w-full + min-w-0 son OBLIGATORIOS: <main> es un flex-col, y un hijo con
// mx-auto dentro de un flex-col deja de estirarse y pasa a medir lo que
// pida su contenido (hasta max-w-7xl = 1280px). Con una tabla ancha
// adentro, la pagina entera quedaba mas ancha que la pantalla en
// notebooks y celulares: botones del encabezado y la columna Acciones
// cortados, sin scroll para alcanzarlos.
export const PAGE_CONTAINER_CLASS = 'w-full min-w-0 p-3 sm:p-5 md:p-6 xl:p-8 space-y-4 sm:space-y-5 max-w-[1600px] mx-auto animate-fade-in';

// Único breakpoint mobile/desktop de la app -- usar siempre
// useMediaQuery(BREAKPOINT_DESKTOP) en vez de inventar un pixel nuevo. Por
// debajo de esto, una lista se muestra como tarjetas apiladas; desde acá
// para arriba, como tabla.
export const BREAKPOINT_DESKTOP = '(min-width: 768px)';

// Tablas: llenan el ancho disponible del contenedor -- w-full, SIN
// min-w-[Npx] (eso las dimensiona por contenido, no por el espacio real
// de la página, y fuerza scroll horizontal en vez de aprovechar el
// ancho). Texto largo trunca (className="truncate", + atributo title con
// el valor completo) en vez de forzar ese scroll.
//
// A propósito SIN table-fixed: se probó y repartía el ancho en partes
// iguales sin importar el contenido, así que una columna "Acciones" con
// varios botones quedaba angosta y los botones se apilaban verticalmente
// en vez de quedar en una fila. table-auto (el default de <table>, por
// eso no hace falta nombrarlo acá) deja que cada columna pida el ancho
// que su contenido necesita -- las de texto se acotan con w-*/truncate en
// el <th>/<td>, no con un layout fijo parejo para toda la tabla.
//
// Padding de celdas parejo para TODAS las tablas (antes cada pantalla usaba
// px-5, px-4 o px-3 a gusto, y px-5 en 8 columnas se comia ~80px solo en
// aire). Los selectores [&_td]/[&_th] ganan en especificidad sobre un px-*
// suelto en la celda, asi que no hace falta tocar cada <td>. Encabezados
// siempre en una linea (whitespace-nowrap): "OBRA / PROYECTO" partido en
// dos renglones hacia ver la tabla rota.
//
// Envolver SIEMPRE la tabla en un div con TABLE_WRAPPER_CLASS: cuando de
// verdad no cabe (notebook chica + muchas columnas) hace scroll dentro de
// la tarjeta en vez de cortar la columna Acciones.
export const TABLE_CLASS =
  'w-full text-xs [&_th]:px-3 [&_td]:px-3 [&_th:first-child]:pl-4 [&_td:first-child]:pl-4 [&_th:last-child]:pr-4 [&_td:last-child]:pr-4 [&_th]:whitespace-nowrap [&_thead_th]:font-semibold [&_thead_th]:text-[10.5px] [&_thead_th]:tracking-wider [&_thead_th]:text-slate-500';

export const TABLE_WRAPPER_CLASS = 'table-scroll';

// Columna Acciones fija a la derecha: si la tabla igual tiene que hacer
// scroll horizontal, los botones siguen a la vista (con una sombra suave
// que indica que hay contenido por debajo). Aplicar al <th> y al <td>,
// junto con el fondo de esa fila (bg-white en el cuerpo, el del thead en
// el encabezado) -- una celda sticky tiene que ser opaca.
export const STICKY_ACTIONS_CLASS = 'sticky right-0 z-[1] shadow-[-10px_0_12px_-12px_rgba(15,23,42,0.25)]';
