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
  nombre: string;
  codigoHetmo: number | null;
  creadoEn: string;
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
  versiones: ProyectoVersion[];
  creadoEn: string;
  actualizadoEn: string;
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
  | 'CONCILIADA'
  | 'CANCELADA';

export interface OrdenCompraItem {
  id: string;
  ordenCompraId: string;
  materialId: string | null;
  material?: Material | null;
  descripcion: string;
  unidadMedida: string;
  cantidad: number;
  precioUnitario: number;
  recepciones?: RecepcionOCItem[];
}

export interface RecepcionOCItem {
  id: string;
  recepcionId: string;
  ordenCompraItemId: string;
  cantidadRecibida: number;
}

export interface RecepcionOC {
  id: string;
  ordenCompraId: string;
  fechaRecepcion: string;
  guiaDespachoNumero: string | null;
  recibidoPorId: string | null;
  recibidoPor?: { id: string; nombre: string; email: string } | null;
  notas: string | null;
  items: RecepcionOCItem[];
}

export interface OrdenCompra {
  id: string;
  numero: string;
  proyectoId: string;
  proyecto?: Pick<Proyecto, 'id' | 'obra' | 'codigoInterno'>;
  faseId: string | null;
  fase?: { id: string; nombre: string; numeroFase?: number } | null;
  proveedorId: string;
  proveedor?: Proveedor;
  estado: EstadoOC;
  requiereAprobacion: boolean;
  moneda: string;
  fechaCalendarizada: string | null;
  fechaEnvio: string | null;
  creadoPorId: string | null;
  aprobadoPorId: string | null;
  fechaAprobacion: string | null;
  motivoRechazo: string | null;
  items: OrdenCompraItem[];
  recepciones?: RecepcionOC[];
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
  fase?: { id: string; nombre: string; versionId: string };
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
  proyectoId: string;
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

export type TipoMovimientoBodega = 'INGRESO_OC' | 'SALIDA_OBRA' | 'TRASLADO_ENTRADA' | 'TRASLADO_SALIDA' | 'AJUSTE';

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
}