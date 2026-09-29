export interface Rol {
  id: string;
  nombre: string;
  secciones: string[];
  configTabs: string[];
  // 'tecnico' y/o 'gerencial' -- ver ROLES_APROBACION en accessControl.ts.
  aprobaciones: string[];
  // Presente solo en GET /api/roles (include: { _count: { select: { usuarios: true } } }).
  _count?: { usuarios: number };
}

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rolId: string | null;
  rol: Rol | null;
  activo: boolean;
  creadoEn: string;
  // Acceso real (ver ADMIN_EMAILS en mtw-api) -- no depende de rolId/activo,
  // asi que esta fila no es editable desde el panel de Roles de Usuario.
  esAdmin: boolean;
}

export interface MisPermisos {
  email: string;
  nombre: string | null;
  esAdmin: boolean;
  rol: string | null;
  secciones: string[];
  configTabs: string[];
  aprobaciones: string[];
  // Si el usuario ya cargo su token personal de Clay (el token en si nunca
  // vuelve del backend). Sin token no se puede buscar ni contabilizar
  // facturas en Clay.
  tieneTokenClay: boolean;
}

export interface AprobacionPendienteCotizacion {
  tipo: 'aprobacion_gerencial_cotizacion';
  proyectoId: string;
  obra: string;
  codigoInterno: string | null;
  versionId: string;
}

export interface AprobacionPendienteOC {
  tipo: 'orden_compra';
  ordenCompraId: string;
  numero: string;
  proveedorNombre: string;
  // null para una OC de "Obras Mayores" (sin proyecto asociado) -- obra
  // ya trae el nombre correcto en ese caso (ver labelCentroCosto en
  // mtw-api). No se usa para navegar: aprobar/enviar una OC es siempre
  // en el módulo Compras, ver onAbrirCompras.
  proyectoId: string | null;
  obra: string;
  codigoInterno: string | null;
  total: number;
}

export interface AprobacionesPendientes {
  gerencial: (AprobacionPendienteCotizacion | AprobacionPendienteOC)[];
  total: number;
}

export interface Cliente {
  id: string;
  rut?: string | null;
  nombre: string;
  razonSocial?: string | null;
  giro?: string | null;
  direccion?: string | null;
  localidad?: string | null;
  telefono?: string | null;
  email?: string | null;
  contacto?: string | null;
  // Presente solo en GET /api/clientes (include: { _count: { select: { proyectos: true } } }).
  _count?: { proyectos: number };
}

export interface Proveedor {
  id: string;
  nombre: string; // Razon Social
  codigoHetmo: number | null;
  rut: string | null;
  nombreFantasia: string | null;
  giroComercial: string | null;
  direccion: string | null;
  comuna: string | null;
  region: string | null;
  pais: string | null;
  telefono: string | null;
  sitioWeb: string | null;
  contactoNombre: string | null;
  email: string | null;
  emailFacturacion: string | null;
  emailPedidos: string | null;
  emailAvisoPago: string | null;
  condicionesPago: string | null;
  banco: string | null;
  tipoCuenta: string | null;
  numeroCuenta: string | null;
  monedaDefecto: string | null;
  categoria: string | null;
  ibanSwift: string | null;
  creadoEn: string;
  actualizadoEn: string;
  // Cuantos materiales/OC lo tienen enlazado -- en 0/0 es candidato a
  // duplicado (ver bug de codigo_proveedor corregido en mtw-hetmo).
  _count?: { materiales: number; ordenesCompra: number };
}

export interface PrecioHistorial {
  id: string;
  materialId: string;
  precio: number;
  moneda: string;
  fecha: string;
}

export interface Material {
  id: string;
  skuInterno: string;
  descripcion: string;
  familia: string;
  unidadMedida: string;
  individualizado: boolean;
  precioOrigen?: number | null;
  monedaOrigen?: string | null;
  precios?: PrecioHistorial[];
  proveedorId: string | null;
  proveedor?: Proveedor | null;
  creadoEn: string;
}

export interface VentanaGeometria {
  id: string;
  ordenGeometria: number;
  tipoElemento: number | null;
  tipoGeometria: number | null;
  numeroPuntos: number | null;
  anchoMm: number | null;
  altoMm: number | null;
  tipoApertura: number | null;
  posicion: number | null;
  perteneceHueco: number | null;
  numeroHoja: number | null;
  carril: number | null;
  formaCodigo: string | null;
  modificadorX: number | null;
  modificadorY: number | null;
  /**
   * Fila HETMO cruda, sin normalizar (barrotillos_*, bh_*, cota,
   * geometria_n1/n2, altura_manilla, radio/angulo_curvatura, etc.).
   * Respaldo para campos que aún no tienen columna propia -- ver
   * ventanaAdapter.ts:toRawGeometry().
   */
  parametrosJson: Record<string, unknown> | null;
}

export interface MaterialVentana {
  id: string;
  ventanaId: string;
  materialId: string;
  cantidad: number;
  longitudMm: number | null;
  piezas: number | null;
  acabado: string | null;
  precioOrigen: number | null;
  monedaOrigen: string | null;
  origen: 'HETMO' | 'PERSONALIZADO';
  excluido: boolean;
  reemplazaMaterialId: string | null;
  material?: Material;
}

export interface MaterialVersionResumen {
  id: string;
  versionId: string;
  materialId: string;
  cantidadHetmo: number;
  material?: Material;
}

export interface VentanaFase {
  id: string;
  faseId: string;
  ventanaId: string;
  unidades: number;
  notas: string | null;
  ventana?: Ventana;
}

export interface Fase {
  id: string;
  versionId: string;
  numeroFase: number;
  nombre: string;
  descripcion: string | null;
  estado: 'BORRADOR' | 'PLANIFICADA' | 'EN_PRODUCCION' | 'COMPLETADA';
  fechaInicio: string | null;
  fechaEntrega: string | null;
  ventanasFase?: VentanaFase[];
  creadoEn: string;
  actualizadoEn: string;
}

export interface ProyectoMaterialAjuste {
  id: string;
  versionId: string;
  materialId: string;
  precioPersonalizado: number | null;
  monedaPersonalizada: string | null;
  familiaPersonalizada: string | null;
  excluido: boolean;
  origen: string;
  material?: Material;
}

export interface FamiliaMaterialAprobacion {
  id: string;
  versionId: string;
  familia: string;
  aprobada: boolean;
  aprobadoPor: string | null;
  fechaAprobacion: string | null;
  descuentoPct: number | null;
  recargoPct: number | null;
}

export interface FijacionExtra {
  glosa: string;
  monto: number;
}

export interface PresupuestoConfig {
  id: string;
  versionId: string;
  textoPresentacion: string | null;
  condicionesComerciales: string | null;
}

export interface ConfiguracionEmpresa {
  id: string;
  footerWebUrl: string | null;
  footerWebLabel: string | null;
  footerInstagramUrl: string | null;
  footerInstagramHandle: string | null;
  textoPresentacionDefault: string | null;
  condicionesComercialesDefault: string | null;
}

export interface FijacionConfig {
  id: string;
  versionId: string;
  manoObraFabricacion: number;
  filmProtectorCristales: number;
  materialInstalacion: number;
  cantidadViajes: number;
  valorViaje: number;
  valorInstalacionM2: number;
  valorInstalacionProtexM2: number;
  margenVentaPct: number;
  extras: FijacionExtra[];
}

export type SentidoMovimientoHoja = 'fija' | 'izquierda' | 'derecha' | 'ambos' | 'oculta';

export interface CorreccionHoja {
  indice: number;
  ancho: number;
  carril: number; // 1 (C1), 2 (C2), 3 (C3), 0 (Oculta)
  movimiento: SentidoMovimientoHoja;
}

export interface CorreccionGeometria {
  esquema: number; // 1
  lineaHetmo: number;
  apertura: number;
  hojas: CorreccionHoja[];
}

export interface Ventana {
  id: string;
  versionId: string;
  lineaHetmo: number;
  orden: number;
  modelo: string;
  descripcionCorta: string | null;
  unidades: number;
  anchoMm: number;
  altoMm: number;
  m2Ventana: number | null;
  numeroCuadrosHojas: number | null;
  dibujoTipoApertura: number | null;
  acabadoCodigo: string | null;
  acabadoDescripcion: string | null;
  acabadoPatron: string | null;
  importeUnitario: number | null;
  descuentoLinea: number | null;
  comentarioPresupuesto: string | null;
  comentarioFabricacion: string | null;
  correccionGeometria?: CorreccionGeometria | null;
  geometrias?: VentanaGeometria[];
  materiales?: MaterialVentana[];
  ventanasFase?: VentanaFase[];
  // HETMO (default) o PERSONALIZADO -- linea agregada a mano desde
  // Step2Lineas (vidrio DVH fijo, puerta Protex...). Ver Ventana.origen,
  // prisma/schema.prisma.
  origen?: string;
  tipoLineaManual?: 'DVH_FIJO' | 'PROTEX' | null;
  // Espejar el dibujo horizontalmente, de forma permanente -- ajuste
  // manual para ventanas que HETMO entrega "al revés" sin ningún campo de
  // posición izquierda/derecha confiable para detectarlo solo.
  espejado?: boolean;
  // Invierte manualmente qué paño va arriba/abajo en una línea compuesta en
  // vertical (ej. proyectante + fijo) -- para cuando HETMO no define sus
  // paños en el mismo orden que el plano real y no hay una regla física
  // única (a diferencia de una puerta, que siempre llega al piso y no
  // necesita este ajuste, ver compositePanels() en geometryCore.ts).
  ordenPanelesInvertido?: boolean;
}

export interface PlantillaLineaItem {
  id: string;
  plantillaId: string;
  materialId: string;
  material?: Material;
  cantidad: number;
  orden: number;
}

export interface PlantillaLinea {
  id: string;
  tipo: string;
  nombre: string;
  hojas: 1 | 2;
  activa: boolean;
  items: PlantillaLineaItem[];
  creadoEn: string;
  actualizadoEn: string;
}

export interface ProyectoVersion {
  id: string;
  proyectoId: string;
  hetmoId: number;
  versionNumero: number;
  estadoHetmo: number;
  estadoGlosa: string | null;
  fechaDocumento: string | null;
  importeTotal: number | null;
  sumaTotalLineas: number | null;
  monedaCodigo: number | null;
  monedaDescripcion: string | null;
  monedaSimbolo: string | null;
  tipoCambio: number | null;
  
  // Divisas personalizadas por obra
  tipoCambioDolar: number | null;
  tipoCambioUF: number | null;
  tipoCambioEuro: number | null;
  
  // Aprobación y Modificaciones
  tieneModificaciones: boolean;
  estadoAprobacion:
    | 'BORRADOR'
    | 'EN_COTIZACION'
    | 'ESPERANDO_APROBACION_COMERCIAL'
    | 'APROBADO_GERENCIA'
    | 'ACEPTADO_CLIENTE';
  esCongelado: boolean;
  fechaAprobacion: string | null;
  aprobadoPor: string | null;
  
  totalVentanas: number;
  totalM2Ventanas: number | null;
  totalMateriales: number;
  importadoEn: string;
  
  ventanas?: Ventana[];
  fases?: Fase[];
  materialAjustes?: ProyectoMaterialAjuste[];
  familiaAprobaciones?: FamiliaMaterialAprobacion[];
  materialesResumen?: MaterialVersionResumen[];
  fijacionConfig?: FijacionConfig | null;
  presupuestoConfig?: PresupuestoConfig | null;
}

export interface Proyecto {
  id: string;
  hetmoSinVersion: number;
  numeroPresupuesto: number;
  codigoInterno: string | null;
  obra: string;
  clienteNombreRaw: string;
  clienteRutRaw: string | null;
  clienteDireccionRaw: string | null;
  clienteLocalidadRaw: string | null;
  clienteId: string | null;
  cliente?: Cliente | null;
  // Version (ProyectoVersion.hetmoId) elegida para cotizar. null = nunca
  // se eligio y hay que caer de vuelta a la de versionNumero mas alto.
  versionActivaHetmoId: number | null;
  // Nombre EXACTO del centro de costo de esta obra en Clay -- se usa al
  // contabilizar las facturas de sus OC. null = sin centro de costo.
  clayCentroCosto: string | null;
  versiones: ProyectoVersion[];
  creadoEn: string;
  actualizadoEn: string;
  // Resumen para la lista de "Proyectos en curso" -- ver GET /api/proyectos
  // en mtw-api. montoComprometidoOC es la suma real de items de OC de este
  // proyecto (cualquier estado); fasesResumen cuenta las fases reales
  // (numeroFase > 0) de la version mas reciente. No hay "presupuestado"
  // ajustado por familia ni % de avance de fabricacion real todavia -- ver
  // comentario en el handler.
  montoComprometidoOC?: number;
  // Monedas de OC de este proyecto que NO son CLP (no se suman a
  // montoComprometidoOC para no mezclar monedas distintas en un total).
  otrasMonedasOC?: string[];
  fasesResumen?: { total: number; enProduccionOCompletadas: number };
}

export interface ProyectosResponse {
  total: number;
  page: number;
  limit: number;
  data: Proyecto[];
}

export interface SyncLog {
  id: string;
  iniciadoEn: string;
  finalizadoEn: string | null;
  estado: 'EN_PROCESO' | 'EXITOSO' | 'COMPLETADO_CON_ERRORES' | 'ERROR';
  documentosLeidos: number;
  versionesNuevas: number;
  versionesUpd: number;
  detalles: string | null;
  errorMensaje: string | null;
}

// ==========================================
// ABASTECIMIENTO: ORDENES DE COMPRA Y BODEGA
// ==========================================
// Ver mtw-api prisma/schema.prisma seccion 9 para el diagrama de estados.
export type EstadoOC =
  | 'BORRADOR'
  | 'PENDIENTE_APROBACION'
  | 'APROBADA'
  | 'RECHAZADA'
  | 'ENVIADA'
  | 'RECIBIDA_PARCIAL'
  | 'RECIBIDA_TOTAL'
  | 'PARCIALMENTE_CONCILIADA'
  | 'CONCILIADA'
  | 'CANCELADA';

export type CategoriaGasto =
  | 'PERFILERIA'
  | 'HERRAJES'
  | 'VIDRIOS'
  | 'ACCESORIOS'
  | 'REFUERZOS'
  | 'MANO_DE_OBRA'
  | 'FLETE'
  | 'INSTALACION'
  | 'OTROS'
  | 'INSUMOS_GENERALES';

// Config editable por partida (nombre "estandarizado" + codigo de
// integracion con Clay) -- una fila fija por valor de CategoriaGasto, ver
// PartidaConfig en mtw-api/schema.prisma.
export interface PartidaConfig {
  id: string;
  categoria: CategoriaGasto;
  nombre: string;
  integracionClay: string | null;
  actualizadoEn: string;
}

export interface OrdenCompraItem {
  id: string;
  ordenCompraId: string;
  materialId: string | null;
  material?: Material | null;
  descripcion: string;
  unidadMedida: string;
  // Snapshot al crear el item -- automatica desde material.familia si hay
  // materialId, obligatoria a mano si es partida externa (ver
  // categoriaDesdeFamiliaMaterial en mtw-api).
  categoria: CategoriaGasto;
  cantidad: number;
  // Valor teorico antes de redondear a la unidad de compra (ej. barras
  // enteras de Perfileria/Refuerzos) -- solo referencia para poder
  // consultar despues cuanto "de mas" se compro por el redondeo, nunca se
  // usa en ningun calculo de stock/presupuesto. null cuando no hubo
  // redondeo (cantidad ya es el valor exacto).
  cantidadCalculada: number | null;
  // null en una solicitud sin completar -- ver OrdenCompra.proveedorId.
  precioUnitario: number | null;
  recepciones?: RecepcionOCItem[];
  conciliacionItems?: ConciliacionFacturaItem[];
}

// Cuanto de lo pedido de un item sigue sin vincular a una factura /
// sin recibir todavia -- mismo calculo que mtw-api (pendienteConciliarItem/
// pendienteRecepcionarItem en index.ts), hecho aca para no pedirle al
// backend un campo calculado en cada listado que ya trae recepciones/
// conciliacionItems crudos.
export function pendienteConciliarItem(item: Pick<OrdenCompraItem, 'cantidad' | 'conciliacionItems'>): number {
  const vinculado = (item.conciliacionItems || []).reduce((s, v) => s + v.cantidad, 0);
  return Math.max(0, item.cantidad - vinculado);
}

export function pendienteRecepcionarItem(item: Pick<OrdenCompraItem, 'cantidad' | 'recepciones'>): number {
  const recibido = (item.recepciones || []).reduce((s, r) => s + r.cantidadRecibida, 0);
  return Math.max(0, item.cantidad - recibido);
}

export interface RecepcionOCItem {
  id: string;
  recepcionId: string;
  ordenCompraItemId: string;
  // Correlativo unico de esta linea recibida (un "lote": lo que llego de
  // este item en ESTA recepcion) -- codigo es la version legible para
  // pantalla (ej. "PER-000045"), calculada en mtw-api.
  numero: number;
  codigo: string;
  cantidadRecibida: number;
  // Precio real/facturado de este lote si ya se conoce -- null mientras
  // se asuma el precio comprometido de OrdenCompraItem.precioUnitario.
  precioReal: number | null;
}

export interface TipoDocumento {
  id: string;
  nombre: string;
  activo: boolean;
  orden: number;
}

export interface RecepcionOC {
  id: string;
  ordenCompraId: string;
  fechaRecepcion: string;
  tipoDocumentoId: string | null;
  tipoDocumento?: TipoDocumento | null;
  numeroDocumento: string | null;
  recibidoPorId: string | null;
  recibidoPor?: { id: string; nombre: string; email: string } | null;
  notas: string | null;
  items: RecepcionOCItem[];
}

// Un Proyecto (obra real de HETMO) es UN TIPO de centro de costos --
// "Obras Mayores" es otro, sin Proyecto asociado (compras/stock no
// ligados a una obra puntual). Ver CentroCosto en mtw-api/schema.prisma.
export interface CentroCosto {
  id: string;
  nombre: string;
  tipo: 'OBRA' | 'GENERAL';
}

export interface OrdenCompra {
  id: string;
  numero: string;
  // proyectoId puede venir null (compra de "Obras Mayores", sin obra
  // asociada) -- centroCosto es la relacion real de ahora en mas, ver
  // CentroCosto arriba.
  proyectoId: string | null;
  proyecto?: Pick<Proyecto, 'id' | 'obra' | 'codigoInterno'> | null;
  centroCostoId?: string | null;
  centroCosto?: CentroCosto | null;
  faseId: string | null;
  fase?: { id: string; nombre: string; numeroFase?: number } | null;
  // null mientras es una solicitud sin completar (nacida desde un
  // Proyecto, sin proveedor ni precios todavia) -- Compras la completa
  // (PATCH .../completar) antes de poder pedir aprobación.
  proveedorId: string | null;
  proveedor?: Proveedor | null;
  estado: EstadoOC;
  requiereAprobacion: boolean;
  moneda: string;
  fechaCalendarizada: string | null;
  fechaEnvio: string | null;
  comentarios: string | null;
  creadoPorId: string | null;
  aprobadoPorId: string | null;
  fechaAprobacion: string | null;
  motivoRechazo: string | null;
  items: OrdenCompraItem[];
  recepciones?: RecepcionOC[];
  conciliaciones?: ConciliacionFactura[];
  creadoEn: string;
  actualizadoEn: string;
}

export interface OrdenesCompraResponse {
  total: number;
  page: number;
  limit: number;
  data: OrdenCompra[];
}

export type EstadoSolicitudMaterial = 'GENERADA' | 'PENDIENTE_APROBACION_GERENCIA' | 'APROBADA' | 'RECHAZADA' | 'ENTREGADA';

export interface SolicitudMaterialItem {
  id: string;
  solicitudId: string;
  materialId: string;
  material?: Material;
  cantidadSolicitada: number;
  cantidadEntregada: number;
}

export interface SolicitudMaterial {
  id: string;
  faseId: string;
  // version.proyecto solo viaja para poder mostrar la obra en la vista
  // global del modulo Bodega (ver RequisicionesSection con proyecto
  // omitido) -- en la ficha de un proyecto puntual no hace falta, ya se
  // conoce por contexto.
  fase?: { id: string; nombre: string; versionId: string; version?: { proyecto: Pick<Proyecto, 'id' | 'obra' | 'codigoInterno'> } };
  estado: EstadoSolicitudMaterial;
  solicitadoPorId: string | null;
  fechaSolicitud: string;
  revisadoPorId: string | null;
  fechaRevision: string | null;
  notas: string | null;
  items: SolicitudMaterialItem[];
}

export interface Bodega {
  id: string;
  // Legado -- puede venir null para la bodega de un centro de costo
  // GENERAL (ej. "Obras Mayores", sin Proyecto asociado). centroCosto es
  // la relacion real.
  proyectoId: string | null;
  proyecto?: Pick<Proyecto, 'id' | 'obra' | 'codigoInterno'> | null;
  centroCostoId?: string | null;
  centroCosto?: CentroCosto | null;
  nombre: string;
  activa: boolean;
  creadoEn: string;
  actualizadoEn: string;
}

export interface StockMaterial {
  id: string;
  bodegaId: string;
  materialId: string;
  material: Material;
  cantidad: number;
  actualizadoEn: string;
}

export type TipoMovimientoBodega =
  | 'INGRESO_OC'
  | 'SALIDA_OBRA'
  | 'TRASLADO_ENTRADA'
  | 'TRASLADO_SALIDA'
  | 'AJUSTE_POSITIVO'
  | 'AJUSTE_NEGATIVO';

export interface MovimientoBodega {
  id: string;
  bodegaId: string;
  bodegaDestinoId: string | null;
  materialId: string;
  material: Material;
  tipo: TipoMovimientoBodega;
  cantidad: number;
  documentoReferencia: string | null;
  notas: string | null;
  creadoPor?: { id: string; nombre: string; email: string } | null;
  creadoEn: string;
}

export interface BodegaProyectoResponse {
  bodega: Bodega | null;
  stock: StockMaterial[];
  movimientos: MovimientoBodega[];
  // Stock de "Obras Mayores" -- viaja siempre junto al de la bodega propia,
  // para poder calcular cuanto falta comprar de verdad (ver
  // stockDisponiblePorMaterial en materialesConsolidados.ts).
  stockObrasMayores: StockMaterial[];
}

// GET /api/bodega -- todas las bodegas juntas (obras reales + "Obras
// Mayores"), para el modulo Bodega de primer nivel. Cada fila de
// stock/movimiento trae su bodega para poder agrupar/filtrar por obra.
export interface BodegaGlobalResponse {
  bodegas: Bodega[];
  stock: (StockMaterial & { bodega?: Bodega })[];
  movimientos: (MovimientoBodega & { bodega?: Bodega })[];
}

// Material.individualizado (Perfileria/Refuerzos/Vidrios): se compra y
// consume por unidad completa, sin cortes ni remanentes -- ver
// docs/MODELO-DE-DATOS.md seccion 9 en mtw-api.
export type EstadoUnidadMaterial = 'DISPONIBLE' | 'CONSUMIDA' | 'DEFECTUOSA' | 'DEVUELTA_PROVEEDOR';

export interface UnidadMaterial {
  id: string;
  codigo: string;
  estado: EstadoUnidadMaterial;
  creadoEn: string;
  ordenCompraId: string | null;
  ordenCompraNumero: string | null;
  solicitudId: string | null;
}

export interface UnidadesMaterialResponse {
  material: { id: string; descripcion: string; familia: string };
  unidades: UnidadMaterial[];
}

export type EstadoConciliacionFactura = 'PENDIENTE' | 'CUADRA' | 'DIFERENCIA';

// Vinculo confirmado a una factura RECIBIDA real que vive en Clay (no en
// mtw-api) -- ver docs/MODELO-DE-DATOS.md seccion 9 "Integracion con
// Clay". montoFactura/pagada/montoPagado son un cache de lo que Clay
// contestaba al vincular o al ultimo refresco (sincronizadoEn).
export interface ConciliacionFactura {
  id: string;
  ordenCompraId: string;
  clayTransactionId: string;
  folio: string;
  proveedorRutEmisor: string;
  fechaFactura: string | null;
  montoFactura: number; // total con IVA
  // Neto (lo que se compara contra la OC, cuyos precios son netos). null =
  // vinculada antes de guardarlo -- ver netoConciliacion.
  montoNetoFactura: number | null;
  estadoCuadre: EstadoConciliacionFactura;
  pagada: boolean;
  montoPagado: number;
  sincronizadoEn: string;
  vinculadoPorId: string | null;
  fechaVinculacion: string | null;
  notas: string | null;
  // Asiento creado en Clay al confirmar el checkout. null = sin contabilizar.
  clayAsientoId: string | null;
  contabilizadaEn: string | null;
  creadoEn: string;
  items?: ConciliacionFacturaItem[];
}

// Vinculo item a item: que parte de un OrdenCompraItem quedo cubierta por
// que linea (por posicion, facturaLineaIndex) de esta factura puntual --
// ver ConciliacionFacturaItem en mtw-api/prisma/schema.prisma.
export interface ConciliacionFacturaItem {
  id: string;
  conciliacionFacturaId: string;
  ordenCompraItemId: string;
  facturaLineaIndex: number;
  facturaLineaDescripcion: string;
  facturaLineaCantidad: number | null;
  facturaLineaPrecioUnitario: number | null;
  cantidad: number;
  monto: number;
  creadoPorId: string | null;
  creadoEn: string;
}

// Neto de una factura vinculada. Las vinculadas antes de guardar el neto no
// lo tienen: se aproxima quitando el 19% de IVA (mismo criterio que mtw-api).
export function netoConciliacion(c: Pick<ConciliacionFactura, 'montoNetoFactura' | 'montoFactura'>): number {
  return c.montoNetoFactura != null ? Number(c.montoNetoFactura) : Number(c.montoFactura) / 1.19;
}

// Contraparte (emisor/receptor) de un documento de Clay.
export interface ClayContraparte {
  rut: string;
  dv: string;
  company_name: string;
}

// Subconjunto de un documento de GET /v2/obligations/dte que trae
// GET /api/ordenes-compra/:id/facturas-sugeridas -- ver ClayDteItem en
// mtw-api/src/clay-client.ts.
export interface ClayDteItem {
  id: string;
  issue_date: string;
  number: string;
  sii_code: number;
  issuer: ClayContraparte;
  is_received: boolean;
  is_paid: boolean;
  accounted_ok: boolean;
  outstanding_balance: number;
  total: { net: number; exempt: number; vat: number; total: number };
}

export interface FacturaSugerida {
  factura: ClayDteItem;
  netoFactura: number;
  // Contra lo que FALTA facturar de la OC (neto).
  diferenciaVsOC: number;
  cuadra: boolean;
  // Emisor = proveedor de la OC. false solo puede aparecer buscando sin el
  // filtro de RUT.
  mismoProveedor: boolean;
}

export interface FiltrosFacturas {
  rut: boolean;
  monto: boolean;
}

export interface FacturasSugeridasResponse {
  totalOC: number;
  pendienteFacturar: number;
  filtros: FiltrosFacturas & { toleranciaMonto: number };
  sugeridas: FacturaSugerida[];
}

// Una linea del asiento que se va a crear en Clay (checkout).
export interface LineaAsientoClay {
  cuenta: string;
  nombreCuenta: string;
  partidas: string[];
  debe: number;
  haber: number;
  centroCosto: string | null;
}

// Una linea de la factura ya normalizada por mtw-api (ver ClayDteLinea en
// clay-client.ts) -- reconocida:false significa que Clay no la trajo en
// ninguno de los formatos de campo conocidos (parseo defensivo, el shape
// real de una factura tipo DTE no estaba 100% confirmado al escribir esto).
export interface ClayDteLinea {
  indice: number;
  descripcion: string;
  cantidad: number | null;
  precioUnitario: number | null;
  monto: number;
  reconocida: boolean;
}

// Item de la OC con su pendiente ya calculado, tal como lo arma el
// checkout (no es OrdenCompraItem completo, es la vista para vincular).
export interface ItemOCCheckout {
  id: string;
  descripcion: string;
  categoria: CategoriaGasto;
  unidadMedida: string;
  cantidad: number;
  precioUnitario: number | null;
  pendienteCantidad: number;
  pendienteMonto: number;
  pendienteRecepcionar: number;
}

export interface VinculoSugerido {
  facturaLineaIndex: number;
  ordenCompraItemId: string;
  cantidad: number;
  monto: number;
}

// GET /api/ordenes-compra/:id/facturas/:clayTransactionId/checkout -- lo
// que va a pasar al confirmar, sin escribir nada todavia.
export interface CheckoutFactura {
  factura: ClayDteItem;
  netoFactura: number;
  mismoProveedor: boolean;
  ordenCompra: { id: string; numero: string; estado: EstadoOC };
  totalOC: number;
  facturadoPrevio: number;
  facturadoTotal: number;
  diferencia: number; // facturadoTotal - totalOC (neto), informativo
  cuadra: boolean; // informativo -- el estado real lo decide la cobertura por item
  lineasFactura: ClayDteLinea[];
  itemsOC: ItemOCCheckout[];
  sugerencias: VinculoSugerido[];
  // Preview con las sugerencias por defecto -- el estado real se decide con
  // lo que la persona termine confirmando.
  estadoResultante: EstadoOC;
  asiento: {
    fecha: string;
    glosa: string;
    lineas: LineaAsientoClay[];
    // errores != [] bloquea la confirmacion.
    errores: string[];
    advertencias: string[];
  };
}