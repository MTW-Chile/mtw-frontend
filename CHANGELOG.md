# Versiones de MTW ERP

Una sola versión para la plataforma (mtw-frontend y mtw-api llevan la misma en
su `package.json`). Se muestra en el menú lateral como canal + versión, ej.
"Alpha v2.0" (con parche, "Alpha v2.0.1"). La v va siempre en minúscula.

- **Canal y versión mayor** (Alpha → Beta, v2 → v3): los decide Alfredo.
- **Versión menor** (2.0 → 2.1): un conjunto grande de funciones nuevas.
- **Parche** (2.0.0 → 2.0.1): ajustes y mejoras acotadas, cada despliegue.
- **Corrección urgente** sobre un parche (2.0.4 → 2.0.4.1; en package.json, 2.0.4-1): la decide Alfredo.

## Sin publicar — obras legacy

**Obras manuales (legacy): cubicar desde los documentos de fabricación**
- Una obra sin presupuesto **importa** las ventanas de sus documentos de fabricación vinculados: cada una entra con su tipo (el código del modelo del lote), la medida con que se fabricó y su documento, sin posición. Botón «Importar ventanas de fabricación (N)» en Cubicación, también cuando llegan documentos nuevos.
- En el cubicador visual, el filtro por documento muestra solo sus ventanas, cuenta lo que falta por ubicar de ese documento y, al arrastrar un tipo o usar «+ 1», ubica ventanas de ese documento.
- El cubicador de una obra manual es distinto al de una obra cotizada: las medidas que traen los documentos son las finales (sin rectificación ni holgura; un cambio de medida se pide como pendiente), no hay planilla Excel que descargar ni subir, el resumen muestra documentos, superficie y tipos, y el cubicador visual tiene un **filtro por documento de fabricación**. Nada de esto cambia en las obras cotizadas.
- El **nombre de un documento de fabricación** se puede cambiar en Fases y documentos (lápiz): el nuevo nombre va en todas partes y la descripción de HETMO queda al lado, en gris, como referencia; en el cubicador solo el nombre.

**Avanzar el estado de las ventanas en bloque**
- Para una obra que ya estaba en ejecución: «Avanzar estado…» en Cubicación elige torres, pisos, departamentos o ventanas y hasta qué estado llegan (despachadas, recibidas en obra o instaladas), con fecha y notas. Genera lo que falte de cada paso como documentos de regularización (despacho sin guía, recepción, instalación sin foto) y deja el historial de cada ventana; no toca guías electrónicas ni estados de pago. Nuevo permiso **Regularizar obras en curso** (`obras.regularizar`), sin asignar a ningún rol hasta que se decida.

**Pendientes: página «Nuevos pendientes»**
- El alta de pendientes deja de ser un formulario suelto: es una página de la obra (obras cotizadas y manuales por igual) con la cubicación a la izquierda y un buscador por torre, piso, departamento, nomenclatura, apertura o documento de fabricación. Al tocar una ventana se ve todo lo que sabemos de ella: dibujo, ubicación, estado, documento y modelo en HETMO, medida de fabricación, marcos y hojas con su medida, vidrios con su medida y materiales (leídos de HETMO), y sus pendientes abiertos.
- Debajo, el formulario del pendiente (qué falta, motivo, a cargo de quién, hoja, vidrio o material concreto, rectificación de medidas, notas y fecha) se **agrega a un listado**; se pueden juntar varios de varias ventanas y se envían todos de una vez, todo o nada. Los adjuntos se agregan después desde el detalle de cada pendiente.
- Desde Instalación, el pendiente de una ventana sigue abriéndose en su ficha.
- Pensada para tablet: hasta pantallas anchas son dos columnas (cubicación y ficha), el listado va bajo el formulario y una barra fija abajo lleva el envío; la ficha se acomoda al ancho de su columna.
- Las ventanas de una obra manual se dibujan: al vincular o releer un documento de fabricación se guarda la geometría de cada ventana desde su documento de venta, y la ficha la dibuja con el mismo motor de las cotizadas.

**Obras manuales: nombres y cuadros**
- Las ventanas importadas conservan el nombre con que vienen del documento de fabricación (es como se identifican en obra) y no se renombran al ubicarlas, moverlas ni renombrar su torre o departamento.
- Corregido: cuando HETMO deja de entregar los marcos y hojas de un lote (pasa al finalizarlo), ya no se marcan como retirados; se conservan los leídos antes y se reponen si una lectura anterior los había quitado.

**Eliminar proyectos y obras manuales (solo superadministrador)**
- El borrado físico de un presupuesto (Presupuestos) pasa a exigir el permiso técnico `sistema.proyectos_eliminar`: antes bastaba con poder archivar presupuestos. Una obra manual se elimina desde Obras en curso con el mismo permiso (ícono de papelera en su fila).
- Se bloquea si el proyecto tiene órdenes de compra, estados de pago, adicionales o movimientos de bodega; la cubicación, los documentos de fabricación, los despachos de regularización, las instalaciones y los pendientes se borran con él.

**Analítica de materiales**
- Corregido: la moneda de origen de un material es siempre la de su tipo de producto (o la que eligió una línea agregada a mano); editar un precio nunca la cambia. Los precios editados antes, que habían quedado etiquetados en pesos, vuelven a mostrarse en su moneda de origen: el número se lee en la moneda del tipo, o se convierte si estaba guardado en pesos (se toma la lectura más parecida al precio de HETMO).

- Bajo el total CLP de cada material va, más chico y en gris, el mismo total en la moneda de origen, como referencia.
- Corregido: el **formato de venta** de los accesorios (tira, rollo, caja, con sus unidades de precio por cada una, del material o de su tipo) no se aplicaba en la Analítica: un portafelpa que se vende en tiras seguía en metros a precio por metro. Ahora la cantidad pasa a unidades de compra enteras y el precio a esa unidad, igual que la perfilería por barra. Sin formato propio no cambia nada.

**Proveedores**
- Botón «Nuevo proveedor» en el encabezado (como en Clientes): abre la ficha de facturación completa.
- Solo superadministradores: ícono de ojo para **ocultar** un proveedor de HETMO que no se usa o viene mal; deja de ofrecerse en el maestro y en los selectores sin tocar sus materiales ni OC. Abajo queda la lista de ocultos, con «Mostrar». Permiso técnico `sistema.proveedores`.

**Base de datos**: migraciones `obras_legacy_cubicacion` y `proveedores_ocultos` (`Proyecto.hetmoSinVersion` opcional: los proyectos manuales dejan el id sintético negativo; `FabricacionVentana.descripcionCorta`). **Agente HETMO**: `/fabricaciones/{id}/ventanas` entrega `descripcion_corta` (la apertura de cada ventana del lote); con el agente anterior la apertura del tipo queda como el código.

## Alpha v2.2.0 — 2026-10-28

**Estados de pago por hitos (Comercial)**
- Cada ventana se cobra en cuatro hitos: marco, hoja, R1 y RF. Los porcentajes, el anticipo y la retención se configuran **por obra** (Configuración de cobro en la pestaña Estados de pago); Configuración › Comercial guarda solo los valores por defecto para una obra nueva (45 / 45 / 5 / 5).
- Los montos cobrados solo los ve quien tiene el permiso de ver estados de pago: sin él, las listas y la ficha de la obra no los muestran.
- Los estados de pago anteriores (marco / hoja / completa) se conservan tal cual.

**Abastecimiento: una pantalla por rol**
- **Solicitud de materiales** (Obra › Abastecimiento, Fases y Pendientes): quien pide material ve el stock como columnas (Necesario · Obra · Obras Mayores · A pedir), sin proveedor ni precio. Un ítem de texto libre (flete, servicio) solo pide la partida.
- **Completar solicitud / Nueva OC** (Compras): columnas de stock y traslado, y el último precio pagado a ese proveedor como sugerencia (se avisa si difiere del de la cotización; el precio acordado no se reemplaza).
- **Recepción en bodega** como página pensada para tablet: filas de dos renglones, contador − / +, "Llegó todo" en un toque, observación por lote (llegó dañado o incompleto) y los códigos de rotulado en grande al terminar. El acuse de un despacho en obra usa la misma lista.
- Corregido: el detalle de una OC con recepciones devolvía error; el código de lote sale ahora de la partida.

**Despachos, Bsale e indicadores**
- **Despachos** es una sección propia del menú (antes, pestaña de Fabricación), con las obras en curso y su avance de despacho.
- El token y los parámetros de la guía electrónica de **Bsale** se cargan desde Configuración › Integraciones (quedan cifrados en la base); las variables del servidor pasan a ser solo respaldo.
- **Indicadores económicos** del día (UF, dólar, euro, UTM) guardados por fecha, con la clave de la CMF en Configuración › Integraciones y respaldos si la CMF no responde.
- La descripción de cada ventana en guías e ítems lleva un orden fijo: posición · medida · sistema (parte).

**Inicio, menú y listas**
- La **página de inicio** se configura por rol (qué módulos y en qué orden) en Configuración › Roles.
- **Bodega** es un módulo propio (resumen, bodegas, recepciones de OC y requisiciones de las obras); **Pendientes** es el visor global de todas las obras; **Reportes** aparece como "Pronto".
- Las listas de **Obras en curso** y **Fabricación** muestran lo suyo: venta contratada en UF, comprometido en OC y estados de pago en Comercial; ventanas cubicadas, fabricadas, despachadas e instaladas en el taller. La ficha de la obra parte en Información General en ambas.
- Los filtros por estado de todas las listas usan la misma pieza (Todos primero, con el conteo de cada opción).

**Obras manuales**
- Al crear la obra se elige su **número de proyecto** (se comprueba que esté libre); queda con código PRJ-año-número, como las de HETMO, y así se detecta su carpeta de OneDrive.
- **Vincular documentos de fabricación** admite marcar varios y vincularlos de una vez.
- En Comercial, la obra manual tiene solo Información General: documentos de fabricación y sus ventanas, fabricadas, cubicadas, despachadas, instaladas y pendientes, más la carpeta de OneDrive.

**Base de datos**: cinco migraciones (`hitos_cobro_por_obra`, `indicadores_economicos`, `inicio_y_clave_cmf`, `observacion_recepcion_oc`, `configuracion_bsale`), ensayadas sobre la copia de producción del 2026-10-26. Ver `mtw-api/docs/RUNBOOK-MIGRACIONES.md`.

## Alpha v2.1.0 — 2026-10-24

**Fabricación → Despachos a obra**
- La sección Fabricación del menú ya es real: lista las obras en curso y abre cada una con las pestañas del taller (Cubicación, Fases y documentos de fabricación, y la nueva pestaña **Despachos**).
- Un despacho toma las ventanas fabricadas de una fase (o algunas, o separadas en marco y hoja cuando la ventana tiene hojas) y al emitirlo salen de fábrica: la obra lo ve como recepción pendiente. Guía de despacho electrónica en **Bsale** (código SII 52), guía manual o sin guía; si Bsale falla el despacho queda emitido y la guía se reintenta.
- Cada ventana lleva su estado en obra, derivado de lo que pasó: cubicada → en fabricación → fabricada (HETMO) → despachada → recibida → instalada.

**Instalación (nueva sección, rol Supervisor de Instalación)**
- Lista de obras en curso con el avance y los despachos por recibir. Al entrar, la cubicación del edificio (torre › piso › departamento) con cada ventana coloreada por estado; pensada para el celular.
- **Recibir** un despacho como se recibe una OC en bodega: se marca lo que llegó, con observaciones; lo demás queda pendiente en el mismo despacho.
- Tocar una ventana abre su ficha con el **dibujo**, medidas, lote de HETMO, historial y pendientes. Desde ahí: **Marcar instalada** (pide la foto, que va a OneDrive en `Instalacion/<nomenclatura>`), o **Pendiente** (el modal de pendientes de siempre, ya ligado a la ventana cubicada).
- Los modales de pendientes muestran el dibujo de la ventana.

**Estados de pago (Comercial, pestaña de la obra)**
- Fases o elementos de la cubicación (ventanas enteras, o **marco y hoja** por separado según el porcentaje de Configuración › Comercial), adicionales aceptados e ítems libres componen cada estado de pago. Montos en UF al precio congelado del presupuesto; retención, anticipo y descuentos.
- Ciclo: borrador → presentado → aprobado → facturado (UF del día) → pagado; rechazado vuelve a borrador; anulado libera sus ítems.

**Para desplegar:** correr la migración `20261024000000_despacho_instalacion_estados_pago` (crea el rol Supervisor de Instalación y los permisos nuevos). Para la guía electrónica, configurar `BSALE_ACCESS_TOKEN` y, si aplica, `BSALE_OFFICE_ID` / `BSALE_SHIPPING_TYPE_ID` en mtw-api.

## Alpha v2.0.5 — 2026-10-21

**Cubicación por casa (Retail y Condominio)**
- El tipo de proyecto define cómo se cubica: por edificio (torres, pisos y departamentos) o por casa (casas, pisos y recintos). Retail queda por casa y se crea el tipo Condominio; en Configuración › Comercial › Tipos de proyecto hay una columna "Cubica como" para elegirlo.
- Obras por casa: «Armar la casa» (pisos y recintos de una vez), «+ recinto», «Copiar casa» (para condominios con la misma casa repetida) y «+ Exterior». La nomenclatura queda `V01_C3_DORM1` (una sola casa: `V01_DORM1`), sin espacios.
- La ubicación de cada ventana se llena sola: en una casa es el nombre del recinto; en un departamento se pueden crear ubicaciones (DORM 1, ESTAR…) con «+ ubicación» y soltar la ventana en una.
- Lápiz para renombrar departamentos, recintos y ubicaciones: las ventanas recalculan su nomenclatura y ubicación.
- Corregido: arrastrar una ventana a otro departamento la dejaba sin ubicar.

**Cubicación única y fases**
- Toda fase se arma desde la cubicación, para que cada ventana tenga nomenclatura y medida rectificada: se quitó crear fases con líneas y cantidades a mano y el botón «Crear fase única». Editar una fase solo cambia su nombre y fechas.
- Nuevo botón «Crear cubicación única» (y «Deshacer»): para una obra que no se reparte por torre, piso y departamento, nombra todas las ventanas (`V01`, o `V01-1`, `V01-2`… si hay más de una) y se rectifican y arman fases igual. En la lista de Ventanas la ubicación se edita en la misma fila.

**Pantallas**
- iPhone, iPad y Android: el encabezado y la barra de abajo (Presupuestos) quedan fijos; ya no se esconden al hacer scroll.
- El anuncio de Inicio es una franja más delgada y con letra más chica; las migas de pan también son más chicas.

**Para desplegar:** correr las migraciones `20261020000100_modo_cubicacion` y `20261020000200_recintos_de_unidad`.

## Alpha v2.0.4.1 — 2026-10-20

**Correcciones urgentes**
- Hoja de Fijación: "Solicitar aprobación gerencial" exigía aprobar partidas que solo tienen costos de la hoja (Instalación, Flete, Sin asignar) y que no se aprueban en ningún lado; ahora usa el mismo criterio que la Analítica (Casa Las Palmas).
- Encabezado en pantallas angostas y móviles: migas de pan en dos líneas cuando no caben en una (también en móvil, donde no aparecían), encabezado más bajo, menú de usuario a lo ancho de la pantalla, botones del encabezado solo con ícono, centro de costo de Clay en Información General cuando no cabe.
- Las acciones de cada sección bajan a su propia fila cuando no caben junto al título; los avisos con botón ya no aprietan el texto; métricas de a dos en móvil.

## Alpha v2.0.4 — 2026-10-19

**Compras**
- Corregido: "Solicitar materiales" fallaba ("Cannot read properties of undefined (reading 'map')") si antes se había abierto Proveedores.
- Los vidrios de las líneas agregadas a mano (DVH fijo y puerta Protex) guardan la medida de cada pieza: en la OC salen individualizados como los de HETMO (en una Protex, un vidrio por hoja). Las líneas ya creadas se corrigen al publicar.

**Obras en curso**
- La fabricación se pone al día con HETMO al abrir la obra (lotes nuevos y estado de cada fase), sin esperar el sync automático; el sync también revisa las obras manuales con fabricación vinculada.
- Nueva métrica en Información General: Ventanas producidas (unidades de las fases completadas sobre el total).

**Presupuestos**
- "Reimportar desde HETMO" lee solo los presupuestos de esa obra (antes corría la sincronización completa de todos) y avisa el resultado.

**Configuración**
- Subir y quitar el logo funcionan en producción (usaban métodos que Cloudflare bloquea).

## Alpha v2.0.3 — 2026-10-19

**Dibujo de ventanas**
- Cada ventana con su propio acabado (color), según sus perfiles: una obra con ventanas de dos colores ya no sale entera de uno.
- Correderas de 3 hojas con la hoja fija y los rieles que declara HETMO en el despiece (requiere el agente HETMO nuevo y volver a sincronizar el presupuesto).
- Limpieza del dibujador: fuera el armado de compuestas por medidas, la regla "la puerta siempre abajo" y el botón "Invertir orden" (las uniones de HETMO los reemplazan). Comprobado con las 7.826 ventanas de producción: ningún dibujo cambia.

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
