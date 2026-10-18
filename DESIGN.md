# Sistema de diseño de MTW ERP

Reglas **obligatorias** para toda pantalla del frontend, nueva o modificada.
Complementa `mtw-api/docs/ARQUITECTURA.md` (2.7). Si una pantalla necesita
algo que estas reglas no cubren, se agrega aquí y en `src/components/ui`
primero; nunca se resuelve con una variante hecha a mano en la pantalla.

El linter (`npm run lint`, oxlint) hace cumplir lo verificable: elementos HTML
reemplazados por componentes (`react/forbid-elements`) y diálogos del
navegador (`no-alert`). Solo `src/components/ui` y el marco de la app
(`Sidebar`, `Header`, `NavControls`) usan los elementos HTML directamente.

## 1. Principios

1. **Una sola forma de hacer cada cosa.** Una tabla, un modal, un campo, un
   aviso: siempre el componente de `src/components/ui`. Si no sirve, se
   mejora el componente, no se copia.
2. **La pantalla no calcula ni decide reglas de negocio.** Muestra lo que
   entrega la API (ver ARQUITECTURA.md 2.6 y 2.7).
3. **Densidad de herramienta de trabajo.** Texto base `text-xs`, números
   alineados a la derecha con `tabular-nums`, sin decoración que no informe.
4. **Móvil primero en el ancho.** Nada desborda la página a 360 px: las tablas
   hacen scroll dentro de su tarjeta y las acciones bajan de fila.
5. **Accesible.** Todo control tiene nombre (etiqueta visible o
   `aria-label`), foco visible y se opera con teclado; `Escape` cierra modales.

## 2. Tokens

Definidos en `src/index.css` (`@theme`). No se usan colores hex en clases.

| Uso | Token |
|---|---|
| Marca / acción principal | `brand-*` (600 base, 700 hover) |
| Texto y superficies | `slate-*` (900 título, 800 texto fuerte, 600 texto, 500 secundario, 400 ayuda) |
| Éxito | `emerald-*` |
| Advertencia, "por revisar" | `amber-*` |
| Error, peligro | `rose-*` |
| Información | `sky-*` |
| Destacado secundario | `violet-*` |

Radios: `rounded-2xl` tarjetas y modales, `rounded-xl` campos y botones,
`rounded-lg` controles compactos dentro de tablas. Sombras: `shadow-sm` en
tarjetas, `shadow-2xl` solo en modales.

## 3. Tipografía

| Elemento | Clases |
|---|---|
| Título de página | `PageHeader` (`text-lg font-extrabold`) |
| Título de sección | `Seccion` (`text-xs font-bold uppercase tracking-wider text-slate-800`) |
| Texto | `text-xs text-slate-600/700` |
| Ayuda, metadatos | `text-[11px] text-slate-500` o `text-[10px] text-slate-400` |
| Montos y cantidades | `tabular-nums` (y `font-mono` solo en tablas de montos) |
| Códigos (SKU, N° OC) | `font-mono text-[11px]` |

Montos, fechas y unidades se formatean **siempre** con `src/lib/formato.ts`
(`clp`, `uf`, `cantidad`, `fecha`, `fechaHora`), nunca con
`toLocaleString` suelto.

## 4. Estructura de una página

```
<div className={PAGE_CONTAINER_CLASS}>
  <PageHeader title=… description=… actions=… />   o  <HeaderSeccion/>
  <SubTabs/>                (si tiene secciones)
  <Seccion titulo=… descripcion=… acciones=…>…</Seccion>
</div>
```

- Pestañas de segundo nivel: `SubTabs`, con la pestaña activa en la URL.
- Navegación de configuración con muchas secciones: `NavLateral`.
- Contenido agrupado en `Seccion` (tarjeta con encabezado). Sin tarjetas
  dentro de tarjetas.

## 5. Componentes

| Necesidad | Componente | No usar |
|---|---|---|
| Acción | `Button` (variantes `primary`, `outline`, `ghost`, `danger`, `subtle`, `link` para acciones dentro de un texto), `IconButton` con `etiqueta` | `<button>` suelto |
| Tabla | `Tabla`, `Thead`, `Th`, `Tbody`, `Tr`, `Td`, `FilaVacia` | `<table>` suelto |
| Modal | `Modal` (+ `Modal.Pie`) | `div fixed inset-0` |
| Confirmar / pedir un texto | `useConfirmar()`: `confirmar(…)`, `pedirTexto(…)` | `window.confirm`, `window.prompt` |
| Avisar un error o éxito | `mostrarToast` | `window.alert` |
| Aviso en la página | `Aviso` (`info`, `exito`, `advertencia`, `peligro`) | cajas de color a mano |
| Campo con etiqueta | `Input`, `Select`, `Textarea`, `NumeroInput`, `Campo` | `<input>`, `<select>`, `<textarea>` sueltos |
| Campo dentro de una tabla editable | `InputCompacto`, `SelectCompacto`, `NumeroInput` (siempre con `aria-label`) | |
| Sí/no | `Interruptor` (ajuste; `label` + `enTarjeta` en grillas) o `Casilla` (selección en lista) | checkbox suelto |
| Una opción entre pocas (formulario) | `OpcionesTarjeta` (radio en tarjetas); entre muchas, `Select` | radios sueltos |
| Vista o filtro entre pocas opciones | `Segmentado` (con `contador` opcional) | botones de color a mano |
| Buscar en una lista | `Buscador` | input con lupa a mano |
| Filtrar un listado por estado o categoría | `FiltroChips` (chips en escritorio, selector en móvil) | chips y selects a mano |
| Menú desde un botón (saltar a un paso, acciones) | `MenuDesplegable` | popovers a mano |
| Resultado clicable en un buscador | `BotonFila` | |
| Subir archivos | `InputArchivo` + un `Button` | `<input type="file">` suelto |
| Estado de carga / vacío / error | `Cargando`, `EstadoVacio`, `ErrorCarga` | spinners y textos sueltos |
| Lista de registros con pocos campos | `Lista`, `FilaLista` (dentro de `Seccion sinRelleno`) | tarjetas por fila a mano |
| Estado de un registro | `Badge`; si se cambia con un clic, `BadgeBoton` | spans con color |
| Grupo que se abre y cierra | `BotonColapsar` | |
| Herramienta activable (Espejar) | `BotonAlternar` | |
| Texto que se edita en el lugar | `ActivadorEdicion` + su campo | |
| Indicador numérico | `StatCard` | |

### Reglas de uso

- **Botones:** una sola acción `primary` por zona. Destructivas en `danger` y
  siempre con `confirmar({ peligro: true })`. Íconos de `lucide-react` en
  `leftIcon`, de 3.5 × 3.5.
- **Tablas:** encabezados cortos en mayúsculas; números a la derecha; la
  última columna son las acciones; fila sin datos con `FilaVacia`. En móvil,
  si la tabla tiene más de 5 columnas, se ofrece una vista de tarjetas
  (`useMediaQuery(BREAKPOINT_DESKTOP)`).
- **Modales:** título y subtítulo, cuerpo con scroll, pie con Cancelar
  (`outline`) a la izquierda de la acción principal. No se cierran al hacer
  clic fuera (se perderían datos); sí con `Escape` y la X.
- **Formularios:** etiqueta arriba, ayuda debajo, error en `rose`. Guardado
  explícito con un botón, o al salir del campo (`NumeroInput`) cuando la
  tabla es editable en línea; nunca en cada tecla.
- **Estados "por revisar"** (sin asignar, por clasificar, sin medidas): ámbar,
  con el motivo en el `title` o en un `Aviso`.
- **Permisos:** sin el permiso, el control no se muestra (o se muestra
  deshabilitado si ayuda a entender el flujo). La API valida igual.

## 6. Textos

Español de Chile, tuteo, frases cortas. Los botones dicen la acción
("Guardar", "Generar OC"), no "Aceptar". Los errores dicen qué pasó y qué
hacer. Sin mayúsculas sostenidas salvo encabezados de tabla.

## 7. Al construir algo nuevo

1. Usa los componentes de `src/components/ui`; si falta algo, agrégalo ahí.
2. `npm run lint` sin errores, `tsc -b` y pruebas en verde.
3. Revisa la pantalla a 360 px y a escritorio.
