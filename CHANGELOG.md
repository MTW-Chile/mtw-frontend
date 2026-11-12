# Versiones de MTW ERP

Una sola versión para la plataforma (mtw-frontend y mtw-api llevan la misma en
su `package.json`). Se muestra en el menú lateral como canal + versión, ej.
"Alpha v2.0" (con parche, "Alpha v2.0.1"). La v va siempre en minúscula.

- **Canal y versión mayor** (Alpha → Beta, v2 → v3): los decide Alfredo.
- **Versión menor** (2.0 → 2.1): un conjunto grande de funciones nuevas.
- **Parche** (2.0.0 → 2.0.1): ajustes y mejoras acotadas, cada despliegue.
- **Corrección urgente** sobre un parche (2.0.4 → 2.0.4.1; en package.json, 2.0.4-1): la decide Alfredo.

## Sin publicar — fases creadas en HETMO

**Obras en curso › Fases**, en obras cotizadas en HETMO (se activa con `HETMO_FASES_ESCRITURA` en la API y la escritura del agente).
- Al crear una fase desde la cubicación, se crea también en HETMO: una línea por ventana cubicada, con su nomenclatura como nombre y su medida rectificada. Si HETMO no la acepta (por ejemplo, pide más unidades de las que quedan), la fase no se crea.
- Cada fase muestra su número de fase en HETMO y el estado de su documento allá.
- Si HETMO no alcanza a responder, la fase queda «sin confirmar» con el botón «Confirmar en HETMO», que primero revisa si ya existe allá.
- Una fase que existe en HETMO no se puede eliminar desde el ERP.
- Una fase solo se puede crear con ventanas ya rectificadas (en cualquier obra). El selector marca las que faltan; si la selección trae alguna, la fase no se crea y se listan.
- El documento de fabricación de una fase creada así se vincula solo a la fase y a sus ventanas cubicadas.

## Sin publicar — conciliación de la cubicación con la planilla de control (obras en ejecución)

La planilla de control pasa a ser la lista de lo que la obra espera, y lo que queda pendiente ya no se pierde al cerrar el aviso.
- **Sin fabricar**: una fila de la planilla sin ventana fabricada deja su **lugar en el cubicador** (borde punteado, «sin fabricar»), pendiente de conciliarse con un documento de fabricación nuevo. Cuando ese documento se vincula, el lugar se llena solo con el nombre, la medida y el dibujo del documento. Cada piso avisa cuántas le faltan.
- **Reposiciones**: una ventana fabricada más de una vez es una sola ventana; **vale la del documento más nuevo** y las anteriores quedan registradas como reemplazadas (se ve en la ventana y en Conciliación). Ya no depende del orden en que se vinculen los documentos.
- **Fabricadas que la planilla no pide**: siguen por ubicar, ahora marcadas «La planilla no la pide».
- **Torre**: al calzar una fila con su ventana se compara también la torre («211O» es de la torre Oriente aunque la planilla la escriba completa); antes dos torres con el mismo número de depto podían cruzarse.
- **Pestaña Conciliación** (Cubicación): sin fabricar, fabricadas que la planilla no pide y reposiciones, siempre disponibles y con buscador. El resumen muestra cuántas ventanas faltan fabricar.
- Volver a subir la planilla de una obra ya cargada la pone al día con estas reglas (las repetidas que habían quedado «por ubicar» se registran como reposición).

## Sin publicar — direcciones en formato SII y tipos de proyecto

- **Direcciones como las pide el SII** (facturas, guías de despacho, OC): dirección, **comuna** y **ciudad** por separado, con **Región** como desplegable que deja en «Comuna» solo las de esa región (16 regiones, 346 comunas). Aplica a Clientes (maestro y cliente nuevo del paso 1), Proveedores, la dirección de la obra y la dirección de entrega de los despachos. Lo que ya estaba escrito y coincide con una comuna se ordenó solo («Las Condes, Santiago» → comuna Las Condes, ciudad Santiago); lo demás queda como «(anterior)» hasta que se corrija.
- **Dirección de la obra** en el paso 1 de la cotización (Identificación) y en la Información General de la obra (Comercial › Obras en curso), además de al crear una obra manual: es a dónde van los despachos y sale en su guía; aparece también en el PDF del presupuesto («Ubicación») y en las listas de Despachos e Instaladores. Sin dirección de obra, el despacho parte de la del cliente, como antes.
- **Guía de despacho (Bsale)**: ahora lleva la comuna del cliente y la comuna y ciudad de la obra.
- **Tipos de proyecto**: «Obra» pasa a llamarse **Edificio**. Edificio y Condominio son obras mayores; Retail es retail (define la carpeta de OneDrive). Condominio y Retail se siguen cubicando como casa.

## Sin publicar — OneDrive: carpeta comercial y carpeta de producción

Cada obra pasa a tener **dos carpetas** en OneDrive: la comercial (la de siempre) y la de producción, que es la que usa Fabricación.
- **Configuración › OneDrive** pide tres carpetas: la que contiene las carpetas comerciales de **obras mayores** (el ajuste que ya existía), la de las comerciales de **obras retail** (están en otra raíz; vacío = la misma de obras mayores) y la **carpeta de producción** (exclusiva de Fabricación, igual para obras mayores y retail). «Probar conexión» revisa las tres.
- **Configuración › Tipos de proyecto**: columna «OneDrive» para decir si las obras del tipo están en la carpeta de obras mayores (Edificio, Condominio) o en la de retail (Retail).
- **Taller › Fabricación**: la lista muestra la carpeta de producción de cada obra (vincular, cambiar, quitar) y la Información General de la obra abre «Documentos de producción» sobre esa carpeta. Comercial › Obras en curso sigue con la carpeta comercial.
- Los adjuntos de pendientes (fotos, órdenes de compra) y las fotos de instalación van a la carpeta comercial.
- Permiso nuevo **Editar documentos de producción** (roles Producción / Taller y Departamento Técnico / Comercial): vincular la carpeta de producción, crear carpetas y subir archivos en ella.

## Sin publicar — flujo de los pendientes de obras legacy

Los pendientes de las obras manuales (sus compras no se hicieron en el ERP) siguen pasos fijos por área, sin etapas configurables ni OC del sistema.
- **A quién va**: marco, hoja y ventana completa van a **Fábrica**; vidrio y material, a **Compras**. Al ingresarlos, cada área recibe un correo con el detalle y el enlace para abrir cada pendiente.
- **Visores separados**: Comercial › Pendientes muestra todos; Taller › Pendientes, los de fábrica; Abastecimiento › Pendientes, los de compras. Son secciones distintas (el menú marca solo la que está abierta).
- **Pasos**: Ingresado (quién) → Recibido (quién del área lo abrió) → *Compras:* En proceso de compra (subiendo la OC, que queda en la carpeta de OneDrive de la obra) → Listo para despacho (al marcarlo recibido: entra a la bodega de la obra, que se crea sola) · *Fábrica:* En producción (con fecha estimada y comentarios; se salta si ya está en fábrica) → Listo para despacho → Despachado.
- **Despacho**: en Despachos › obra aparecen los «Pendientes listos para despacho»; se arma un despacho con ellos, se emite con su guía y quedan Despachado (lo que estaba en la bodega de la obra sale). La obra lo recibe en Instaladores › Recepción.
- **Ingreso**: «Qué falta o falló» y «Motivo» vuelven a ser desplegables, lado a lado.
- **Permisos nuevos**: «Gestionar pendientes de fábrica» (rol Producción / Taller) y «Gestionar pendientes de compras» (rol Compras).
- Los pendientes de obras cotizadas conservan su detalle de siempre; su gestión por pasos está en construcción.

## Sin publicar — Instaladores (recepción, instalación y pendientes en tablet)

«Instalación» pasa a ser el grupo **Instaladores** del menú, con tres secciones que parten de la lista de obras en curso:
- **Recepción**: despachos por recibir y ya recibidos de la obra; el acuse de recibo es una página (antes una ventana emergente), con el lugar de cada ventana y las recepciones anteriores.
- **Instalación**: se marcan una o varias ventanas (o un departamento o un piso entero con «Todo») y se certifican juntas, cada una con su propia foto.
- **Pendientes**: ingreso de lo que falta o falló. Lo que se puede pedir: **Marco, Hoja, Vidrio, Material y Ventana completa** («Otro» queda solo en los pendientes antiguos). En *Material* se ofrecen solo accesorios y herrajes (los tipos de producto marcados «Se repone en obra» en Configuración › Tipos de producto).
- Motivos de un pendiente: **Daño en obra, No recepción y Error de medidas** (los anteriores quedan solo en los pendientes antiguos).
- La ventana elegida se muestra en una ficha compacta: dibujo chico, estado y los datos de su tarjeta en el PDF del presupuesto (ubicación, dimensiones, composición, apertura descrita por el dibujo y vidrios). Ya no lleva materiales, marcos y hojas ni la referencia al documento de fabricación. La misma descripción se usa al editar una ventana en el cubicador.
- Pensado para tablet: desde 840 px de ancho útil, plano y detalle lado a lado; bajo eso, una columna con «Volver al plano». Tipo y motivo se eligen tocando tarjetas (ya no listas desplegables) y el formulario recuerda lo último elegido. El listado («carrito») se revisa en la página y la acción principal queda fija abajo a la derecha.
- Permisos: Recepción e Instalación se ven con «Ver instalación» (actuar exige «Recibir en obra» / «Certificar instalación»); Pendientes, con «Crear pendientes».

## Sin publicar — reserva de materiales

**Obras en curso › Abastecimiento** se separa en *Reserva de materiales* y *Compras*.
- Reserva de materiales: todos los materiales del presupuesto aceptado, en una OC de reserva por partida y proveedor, con el precio cotizado (con el descuento de la partida) en su divisa de origen. Se generan a mano con «Generar reservas»; generarlas dos veces no duplica nada.
- Por cada material: reservado, ya comprado para la obra y saldo. Los vidrios comprados por paño cuentan por su área.
- Una reserva se marca enviada al proveedor o se anula (y vuelve a quedar por reservar). No entra a bodega, a conciliación, al control de presupuesto ni a los últimos precios.
- Mientras la obra no tenga reservas, un aviso amarillo arriba de la obra lo recuerda.
- Pendiente: cambiar el proveedor de una reserva y registrar la respuesta del proveedor.

## Sin publicar — uso con el dedo (tablet y celular)

Revisión contra las pautas de NN/g para tablets (*Tablet Website and Application UX*).

**Todo el sitio**
- Con el dedo, todo botón, botón de ícono, selector, campo, casilla y la X de los modales mide al menos 44 px (~1 cm en tablet); en computador no cambia nada.
- En celular los campos usan letra de 16 px: iPhone ya no hace zoom al tocarlos.
- Texto secundario más oscuro (el gris claro no se leía con sol) y sin texto de 10 px.

**Instalación**
- El listado de instalaciones o pendientes se guarda en el dispositivo hasta enviarlo, con sus fotos: salir, recargar o volver de la cámara ya no lo pierde. El navegador pregunta antes de cerrar la pestaña con algo sin enviar.
- Barra fija abajo con lo que falta enviar; en celular, al tocar una ventana la pantalla va a su ficha y hay un botón para volver al plano.
- Cada estado de ventana lleva su ícono en el plano y en la leyenda, no solo el color.
- Si una foto no sube, el aviso queda hasta cerrarlo.

**Bodega**
- Un error de carga se muestra como error (antes decía «sin recepciones» o «no hay bodegas»).
- Stock y movimientos con buscador y, en celular, como tarjetas.
- Cancelar una recepción con algo marcado pregunta antes.

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

**Documentos de fabricación: copia completa**
- Al vincular o releer un documento se guarda todo de una vez: ventanas, marcos y hojas, vidrios con su medida, materiales y el dibujo. La ficha de la ventana y el alta de pendientes leen de esa copia y ya no consultan HETMO; si HETMO se cae, el módulo sigue operando.
- Un lote finalizado en HETMO queda congelado con su última lectura completa y después solo se actualiza su estado. Un lote que ya estaba finalizado al vincularlo no trae cortes ni dibujo: hay que reabrirlo en HETMO, releerlo y cerrarlo.
- Cada cambio de estado del lote queda en un historial con su fecha.
- **Piezas cortadas y resumen del lote**: de los cortes optimizados se guarda cada pieza de cada marco u hoja (perfil con acabado, largo de corte y posición: superior, inferior, derecha, izquierda) y el resumen de materiales del lote (barras por artículo y acabado, largo cortado, despuntes, pérdidas y faltantes). En Fases y documentos, la columna Cuadros se despliega con las piezas y la vista **Resumen del lote** muestra el consumo por familia. En Nuevos pendientes, la ficha lista las piezas bajo cada marco u hoja, al elegir una hoja se ven sus perfiles y un pendiente de **Material** puede apuntar a una pieza puntual (queda ligada a su cuadro y, si calza, al material del catálogo). Requiere el agente HETMO actualizado; con uno anterior la lectura avisa y sigue.

**Obras manuales: nombres y cuadros**
- En una obra manual, el panel «Por ubicar» del cubicador visual lista cada ventana con su nombre de fabricación, su medida y su documento (no por tipo). Se arrastra al departamento o, en tablet, se toca la ventana y luego «Ubicar aquí» en el departamento; al ubicarla queda elegida la siguiente. El grupo «Cubicación única» pasa a llamarse «Ventanas sin ubicar» en obras manuales.
- En una obra manual, «cubicada» significa tener torre, piso y departamento: las ventanas importadas con su nombre ya no se cuentan como cubicadas ni aparecen «completas» en el panel Por ubicar. Se quitan «Crear» y «Deshacer cubicación única» en obras manuales, que no aplican.
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
