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

export interface Material {
  id: string;
  skuInterno: string;
  descripcion: string;
  familia: string;
  unidadMedida: string;
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
  estadoAprobacion: 'BORRADOR' | 'EN_COTIZACION' | 'APROBADO_GERENCIA' | 'CONGELADO';
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