# Versiones de MTW ERP

Una sola versión para la plataforma (mtw-frontend y mtw-api llevan la misma en
su `package.json`). Se muestra en el menú lateral como canal + versión, ej.
"Alpha v2.0" (con parche, "Alpha v2.0.1"). La v va siempre en minúscula.

- **Canal y versión mayor** (Alpha → Beta, v2 → v3): los decide Alfredo.
- **Versión menor** (2.0 → 2.1): un conjunto grande de funciones nuevas.
- **Parche** (2.0.0 → 2.0.1): ajustes y mejoras acotadas, cada despliegue.

## Alpha v2.0.2 — 2026-10-19

**Dibujo de ventanas**
- Travesaño vertical en los paños fijos de una ventana compuesta (V13 y V14 de Pórtico Vicuña Mackenna).
- Puertas y practicables de dos hojas con hojas de distinto ancho (V17 de Pórtico Vicuña Mackenna: 414 y 900 mm); la manilla va en la hoja móvil.
- Palillaje más delgado y por dentro del vidrio de cada hoja, cortado contra su perfil.
- Machimbre dibujado como tablas del color del acabado en vez de vidrio.
- Manillas, bisagras, marcos y hojas a escala de la medida real (en ventanas grandes se veían enormes); como máximo 4 bisagras por canto.

**Despliegue**
- La API se publica ~4,5 minutos más rápido (sin cambiar el dueño de todos sus archivos al armarse).

## Alpha v2.0.1 — 2026-10-19

**Presupuestos**
- Hoja de Fijación en dos pestañas: la hoja ordenada como el PDF (la que revisa gerencia) y Asignación de costos (partida de cada costo y presupuesto por partida).
- Botón "Analizar precio" en vez de "% Ver % venta".

**Obras en curso**
- Nueva primera pestaña Información General: métricas de la obra, Control de presupuesto por partida (detalle plegado) y Documentos.
- Fabricación va después de Cubicación.
- El cubicador ya no ofrece "Actualizar desde el presupuesto": la obra tiene su presupuesto congelado.

**Inicio y configuración**
- Inicio muestra las últimas pantallas visitadas por el usuario en vez de los accesos a módulos.
- Anuncio para todos los usuarios sobre el buscador de Inicio, en verde, amarillo o rojo según su urgencia (Configuración › Anuncio).
- Configuración de Empresa (antes "Empresa"), con logo propio para los documentos.

**Dibujo de ventanas**
- Las ventanas compuestas se arman con las uniones que declara HETMO (qué paño va arriba, abajo, a la izquierda o a la derecha) en vez de adivinar por medidas: se leen bien las 318 que fallaban (2 paños lado a lado + uno de ancho completo, entre otras).

**Agente HETMO**
- Medidas de cada vidrio y código estable del proveedor (corrige el error de la consulta de materiales por línea).

## Alpha v2.0 — 2026-10-19

Reforma de arquitectura (auditoría 2026-10). Primera versión numerada.

**Seguridad y base**
- Permisos por rol exigidos en cada ruta del API; superadministrador por entorno.
- Entorno validado al arrancar, `/health` mínimo, límites de tamaño y de frecuencia.
- Migraciones versionadas desde una línea base de producción (fin de `asegurarSchema()`).
- API dividido en módulos por dominio.

**Sync con HETMO**
- Nunca borra trabajo del ERP; todo o nada; cuarentena de cambios dudosos.
- Proveedores vinculados por código de HETMO y reparación de duplicados.

**Catálogo y presupuesto**
- Tipos de producto, partidas y unidades configurables; motor único de la Analítica.
- Holgura por partida (se cobra al cliente) en vez de recargo sobre precios.
- Costos de la Hoja de Fijación asignados a su partida; partida "Sin asignar".
- Vidrios y piezas a medida: se cotizan por m² y se compran y reciben por unidad con medidas.
- Configuración comercial: parámetros generales, tipos de proyecto y plantillas de textos.

**Obras, compras y bodega**
- Adicionales: ítems sueltos, recotizar ventanas con precios vigentes o vincular un documento de HETMO; aprobación configurable; ítem libre "por clasificar".
- Compras de presupuesto, reposición o adicional, enlazadas al pendiente de obra.
- Desde la obra se solicitan materiales; la OC la emite Compras.
- Kardex de bodega inmutable; stock mantenido por la base.
- Visor central de pendientes en obra.

**Interfaz**
- Sistema de diseño único (`DESIGN.md`), exigido por el linter.
- Hoja de Fijación y menú de Configuración rediseñados.
- Menú lateral agrupado (Comercial, Taller, Abastecimiento, Contabilidad).
- Migas de pan por nivel en el encabezado.
- Mi configuración (datos personales y token de Clay).
