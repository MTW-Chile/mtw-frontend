export interface Cliente {
  id: string;
  rut: string | null;
  nombre: string;
  direccion: string | null;
  localidad: string | null;
  telefono: string | null;
  email: string | null;
  contacto: string | null;
  creadoEn: string;
}

export interface VentanaGeometria {
  id: string;
  ordenGeometria: number;
  tipoElemento: number | null;
  tipoGeometria: number | null;
  anchoMm: number | null;
  altoMm: number | null;
  tipoApertura: number | null;
  posicion: number | null;
  perteneceHueco: number | null;
  formaCodigo: string | null;
  modificadorX: number | null;
  modificadorY: number | null;
}

export interface MaterialVentana {
  id: string;
  cantidad: number;
  longitudMm: number | null;
  piezas: number | null;
  acabado: string | null;
  precioOrigen: number | null;
  monedaOrigen: string | null;
  material?: {
    id: string;
    skuInterno: string;
    descripcion: string;
    familia: string;
  };
}

export interface Ventana {
  id: string;
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
  importeUnitario: number | null;
  descuentoLinea: number | null;
  comentarioPresupuesto: string | null;
  comentarioFabricacion: string | null;
  geometrias?: VentanaGeometria[];
  materiales?: MaterialVentana[];
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
  totalVentanas: number;
  totalM2Ventanas: number | null;
  totalMateriales: number;
  importadoEn: string;
  ventanas?: Ventana[];
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