# Versiones de MTW ERP

Una sola versión para la plataforma (mtw-frontend y mtw-api llevan la misma en
su `package.json`). Se muestra en el menú lateral como canal + versión, ej.
"Alpha V2.0".

- **Canal y versión mayor** (Alpha → Beta, V2 → V3): los decide Alfredo.
- **Versión menor** (2.0 → 2.1): cada conjunto de cambios que se despliega.
- **Parche** (2.1.0 → 2.1.1): correcciones sin funciones nuevas.

## Alpha V2.0 — 2026-10-19

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
