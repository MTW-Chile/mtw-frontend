import axios from 'axios';
import type {
  ProyectosResponse,
  Proyecto,
  ProyectoVersion,
  Ventana,
  CorreccionGeometria,
  Fase,
  ProyectoMaterialAjuste,
  FamiliaMaterialAprobacion,
  FijacionConfig,
  PresupuestoConfig,
  ConfiguracionEmpresa,
  SyncLog,
  Cliente,
  Material,
  Proveedor,
  PlantillaLinea,
  OrdenCompra,
  OrdenesCompraResponse,
  EstadoOC,
  RecepcionOC,
  TipoDocumento,
  PartidaConfig,
  SolicitudMaterial,
  BodegaProyectoResponse,
  BodegaGlobalResponse,
  MovimientoBodega,
  UnidadesMaterialResponse,
  ConciliacionFactura,
  FiltrosFacturas,
  FacturasSugeridasResponse,
  CheckoutFactura,
  ImportarXmlResponse,
  CategoriaGasto,
  Rol,
  Usuario,
  MisPermisos,
  AprobacionesPendientes,
  FabricacionHetmo,
  FabricacionHetmoBusqueda,
  ResultadoVinculoFabricacion,
  ResultadoDeteccionFabricaciones,
  MaterialesFabricacion,
  EtapaPendiente,
  ObraPendiente,
  ObraPendienteDetalle,
  AdjuntoPendiente,
  OneDriveObra,
  OneDriveEstado,
  Cubicacion,
  ResumenCubicacion,
  TipoCubicacion,
  UnidadCubicacion,
  ReporteImportacionCubicacion,
  FiltroUnidadesCubicacion,
  CarpetaOneDrive,
  CarpetaOneDriveSugerida,
  EstadoPendiente,
  DestinoPendiente,
  NuevoPendientePayload,
} from '../types';

// withCredentials: true es lo que hace que el navegador mande la cookie de
// sesion de Cloudflare Access en cada llamada (relay.mtw.cl/api/* esta
// detras de una Access Application). Sin esto, Cloudflare trata cada
// llamada como no autenticada y bloquea el preflight de CORS antes de que
// llegue al relay. Reemplaza al VITE_SERVICE_TOKEN que se mandaba antes por
// header - ya no hay ningun secreto embebido en el bundle.
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Si la sesion de Cloudflare Access vence a mitad de uso (no solo al cargar
// la app), una llamada posterior va a fallar sin response (Access bloquea
// el preflight antes de que llegue al relay). En ese caso, forzamos el
// mismo flujo de re-login que useCloudflareAccessSession usa al inicio, en
// vez de dejar que la app se quede mostrando un error generico.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const apiUrl = import.meta.env.VITE_API_URL;
    if (!error.response && typeof apiUrl === 'string') {
      try {
        const relayOrigin = new URL(apiUrl).origin;
        // Sin esto, esta rama redirige en silencio ante CUALQUIER falla de
        // red (no solo sesion vencida: un timeout, el backend caido, un
        // payload rechazado) y la navegacion completa borra la pestaña
        // Network/Console antes de que se alcance a leer el motivo real --
        // "se puso rojo y desaparecio", sin ningun rastro. El console.error
        // sirve si hay "Preserve log" activado; el alert() es lo unico que
        // sobrevive la navegacion de forma confiable.
        console.error(
          '[apiClient] Peticion sin respuesta -- redirigiendo a session-check. Metodo/URL:',
          error?.config?.method,
          error?.config?.url,
          'Mensaje:',
          error?.message
        );
        window.alert(
          `No se pudo contactar al servidor (${error?.config?.method?.toUpperCase() || '?'} ${error?.config?.url || '?'}): ${error?.message || 'error de red'}.\n\nSe va a intentar renovar la sesion.`
        );
        window.location.href = `${relayOrigin}/api/session-check?redirect=${encodeURIComponent(window.location.href)}`;
        return new Promise(() => {}); // corta la cadena, la navegacion ya esta en curso
      } catch {
        // VITE_API_URL relativo (dev local) -> no hay Access de por medio, deja pasar el error normal.
      }
    }
    return Promise.reject(error);
  }
);

export async function getProyectos(params?: {
  skip?: number;
  limit?: number;
  estado?: number;
  // Origenes a dejar fuera (coma-separado), ej. 'MANUAL_OBRA': Presupuestos
  // no cuenta las obras manuales porque nunca se cotizaron.
  excluirOrigen?: string;
}): Promise<ProyectosResponse> {
  const response = await apiClient.get<ProyectosResponse>('/proyectos', { params });
  return response.data;
}

export async function createProyectoManual(payload: {
  obra: string;
  // Cliente del maestro. clienteNombre (texto) queda solo por compatibilidad.
  clienteId?: string;
  clienteNombre?: string;
  direccion?: string;
}): Promise<{ proyecto: Proyecto }> {
  const response = await apiClient.post<{ proyecto: Proyecto }>('/proyectos/manual', payload);
  return response.data;
}

// Obra en seguimiento creada a mano (Control de Obras): sin presupuesto de
// HETMO detras. No es lo mismo que createProyectoManual (presupuesto manual
// de Cotizaciones).
export async function crearObraManual(payload: {
  obra: string;
  clienteId: string;
  direccion?: string;
}): Promise<{ proyecto: Proyecto }> {
  const response = await apiClient.post<{ proyecto: Proyecto }>('/obras/manual', payload);
  return response.data;
}

// ---- Control de Obras: fabricacion ----

export async function buscarFabricacionesHetmo(params?: {
  q?: string;
  estado?: number;
  limite?: number;
}): Promise<FabricacionHetmoBusqueda[]> {
  const response = await apiClient.get<FabricacionHetmoBusqueda[]>('/hetmo/fabricaciones', { params });
  return response.data;
}

export async function getFabricacionesProyecto(proyectoId: string): Promise<FabricacionHetmo[]> {
  const response = await apiClient.get<FabricacionHetmo[]>(`/proyectos/${proyectoId}/fabricaciones`);
  return response.data;
}

export async function getFabricacionDetalle(proyectoId: string, fabId: string): Promise<FabricacionHetmo> {
  const response = await apiClient.get<FabricacionHetmo>(`/proyectos/${proyectoId}/fabricaciones/${fabId}`);
  return response.data;
}

export async function vincularFabricacion(proyectoId: string, hetmoId: number): Promise<ResultadoVinculoFabricacion> {
  const response = await apiClient.post<ResultadoVinculoFabricacion>(`/proyectos/${proyectoId}/fabricaciones`, { hetmoId });
  return response.data;
}

export async function detectarFabricaciones(proyectoId: string): Promise<ResultadoDeteccionFabricaciones> {
  const response = await apiClient.post<ResultadoDeteccionFabricaciones>(`/proyectos/${proyectoId}/fabricaciones/detectar`);
  return response.data;
}

export async function refrescarFabricacion(proyectoId: string, fabId: string): Promise<ResultadoVinculoFabricacion> {
  const response = await apiClient.post<ResultadoVinculoFabricacion>(`/proyectos/${proyectoId}/fabricaciones/${fabId}/refrescar`);
  return response.data;
}

// POST y no DELETE: Cloudflare Access bloquea DELETE/PUT en produccion.
export async function desvincularFabricacion(proyectoId: string, fabId: string): Promise<void> {
  await apiClient.post(`/proyectos/${proyectoId}/fabricaciones/${fabId}/desvincular`);
}

// Lectura en vivo de HETMO (no se guarda en la base): vidrios y materiales
// por ventana del documento de fabricacion.
export async function getMaterialesFabricacion(proyectoId: string, fabId: string): Promise<MaterialesFabricacion> {
  const response = await apiClient.get<MaterialesFabricacion>(`/proyectos/${proyectoId}/fabricaciones/${fabId}/materiales`);
  return response.data;
}

export async function eliminarProyecto(id: string): Promise<{ success: boolean; obra: string }> {
  // POST, no DELETE -- Cloudflare Access bloquea DELETE/PUT con "Network
  // Error" en produccion (ver comentario en mtw-api junto al endpoint).
  const response = await apiClient.post<{ success: boolean; obra: string }>(`/proyectos/${id}/eliminar`);
  return response.data;
}

export async function getProyectoById(id: string): Promise<Proyecto> {
  // GET /api/proyectos/:id devuelve el proyecto directo, sin envoltorio.
  const response = await apiClient.get<Proyecto>(`/proyectos/${id}`);
  return response.data;
}

export async function getSyncLogs(limit = 10): Promise<SyncLog[]> {
  const response = await apiClient.get<SyncLog[]>('/sync/logs', {
    params: { limit },
  });
  return response.data;
}

export async function triggerManualSync(
  forceUpdate = false
): Promise<{ success: boolean; message?: string; error?: string }> {
  const response = await apiClient.post<{ success: boolean; message?: string; error?: string }>('/sync/run', {
    forceUpdate,
  });
  return response.data;
}

export async function updateVersionConfig(
  id: string,
  payload: {
    tipoCambioDolar?: number | null;
    tipoCambioUF?: number | null;
    tipoCambioEuro?: number | null;
    estadoAprobacion?: string;
  }
): Promise<{ success: boolean; version: ProyectoVersion }> {
  const response = await apiClient.patch<{ success: boolean; version: ProyectoVersion }>(
    `/versiones/${id}/config`,
    payload
  );
  return response.data;
}

export async function updateProyectoCliente(
  id: string,
  clienteId: string | null
): Promise<{ success: boolean; proyecto: Omit<Proyecto, 'versiones'> }> {
  // El relay ahora sí trae "versiones" en la respuesta (las necesita
  // internamente para congelar la version activa al asignar cliente), pero
  // el shape completo de ProyectoVersion no está resuelto acá -- este tipo
  // se queda angosto a propósito; quien necesite el estado post-congelamiento
  // ya invalida ['proyectoDetail', id] (ver useCotizadorWorkspace), que sí
  // trae todo con el GET completo.
  const response = await apiClient.patch<{ success: boolean; proyecto: Omit<Proyecto, 'versiones'> }>(
    `/proyectos/${id}/cliente`,
    { clienteId }
  );
  return response.data;
}

export async function updateCodigoInterno(
  id: string,
  codigoInterno: string | null
): Promise<{ success: boolean; proyecto: Omit<Proyecto, 'versiones'> }> {
  const response = await apiClient.patch<{ success: boolean; proyecto: Omit<Proyecto, 'versiones'> }>(
    `/proyectos/${id}/codigo-interno`,
    { codigoInterno }
  );
  return response.data;
}

export async function updateClayCentroCosto(
  id: string,
  clayCentroCosto: string | null
): Promise<{ success: boolean; proyecto: Omit<Proyecto, 'versiones'> }> {
  const response = await apiClient.patch<{ success: boolean; proyecto: Omit<Proyecto, 'versiones'> }>(
    `/proyectos/${id}/clay-centro-costo`,
    { clayCentroCosto }
  );
  return response.data;
}

export async function setVersionActiva(
  id: string,
  hetmoId: number
): Promise<{ success: boolean; proyecto: Omit<Proyecto, 'versiones'> }> {
  // Si hetmoId nunca fue sincronizado (version intermedia que HETMO ya
  // superaba cuando corrio el sync automatico), el relay la trae en el
  // momento antes de guardar la eleccion - puede tardar unos segundos.
  const response = await apiClient.patch<{ success: boolean; proyecto: Omit<Proyecto, 'versiones'> }>(
    `/proyectos/${id}/version-activa`,
    { hetmoId }
  );
  return response.data;
}

export async function updateEstadoAprobacion(
  versionId: string,
  estado: 'EN_COTIZACION' | 'ESPERANDO_APROBACION_COMERCIAL' | 'APROBADO_GERENCIA' | 'ACEPTADO_CLIENTE'
): Promise<{ success: boolean; version: ProyectoVersion }> {
  const response = await apiClient.patch<{ success: boolean; version: ProyectoVersion }>(
    `/versiones/${versionId}/estado-aprobacion`,
    { estado }
  );
  return response.data;
}

export async function createFase(
  versionId: string,
  payload: {
    // Opcional: si no se manda, el backend usa el siguiente correlativo
    // disponible (nunca 0, reservado para la Fase Base del sync).
    numeroFase?: number;
    nombre: string;
    descripcion?: string;
    fechaInicio?: string;
    fechaEntrega?: string;
    ventanas: { ventanaId: string; unidades: number; notas?: string }[];
  }
): Promise<{ success: boolean; fase: Fase }> {
  const response = await apiClient.post<{ success: boolean; fase: Fase }>(
    `/versiones/${versionId}/fases`,
    payload
  );
  return response.data;
}

// Edita nombre/estado/fechas de una fase existente y, si se manda
// "ventanas", reemplaza por completo su reparto de unidades (no es un
// merge -- manda la lista completa de lo que esa fase debe tener).
export async function updateFase(
  faseId: string,
  payload: {
    nombre?: string;
    descripcion?: string;
    estado?: Fase['estado'];
    fechaInicio?: string | null;
    fechaEntrega?: string | null;
    ventanas?: { ventanaId: string; unidades: number; notas?: string }[];
  }
): Promise<{ success: boolean; fase: Fase }> {
  const response = await apiClient.patch<{ success: boolean; fase: Fase }>(`/fases/${faseId}`, payload);
  return response.data;
}

export async function deleteFase(faseId: string): Promise<{ success: boolean }> {
  const response = await apiClient.delete<{ success: boolean }>(`/fases/${faseId}`);
  return response.data;
}

export async function saveMaterialAjuste(
  versionId: string,
  payload: {
    materialId: string;
    precioPersonalizado?: number | null;
    monedaPersonalizada?: string | null;
    familiaPersonalizada?: string | null;
    excluido?: boolean;
  }
): Promise<{ success: boolean; ajuste: ProyectoMaterialAjuste }> {
  const response = await apiClient.post<{ success: boolean; ajuste: ProyectoMaterialAjuste }>(
    `/versiones/${versionId}/material-ajustes`,
    payload
  );
  return response.data;
}

export async function setFamiliaAprobacion(
  versionId: string,
  familia: string,
  aprobada: boolean
): Promise<{ success: boolean; familiaAprobacion: FamiliaMaterialAprobacion }> {
  const response = await apiClient.patch<{ success: boolean; familiaAprobacion: FamiliaMaterialAprobacion }>(
    `/versiones/${versionId}/materiales/familias/${encodeURIComponent(familia)}/aprobacion`,
    { aprobada }
  );
  return response.data;
}

export async function setFamiliaDescuento(
  versionId: string,
  familia: string,
  descuentoPct: number
): Promise<{ success: boolean; familiaAprobacion: FamiliaMaterialAprobacion }> {
  const response = await apiClient.patch<{ success: boolean; familiaAprobacion: FamiliaMaterialAprobacion }>(
    `/versiones/${versionId}/materiales/familias/${encodeURIComponent(familia)}/descuento`,
    { descuentoPct }
  );
  return response.data;
}

export async function setFamiliaRecargo(
  versionId: string,
  familia: string,
  recargoPct: number
): Promise<{ success: boolean; familiaAprobacion: FamiliaMaterialAprobacion }> {
  const response = await apiClient.patch<{ success: boolean; familiaAprobacion: FamiliaMaterialAprobacion }>(
    `/versiones/${versionId}/materiales/familias/${encodeURIComponent(familia)}/recargo`,
    { recargoPct }
  );
  return response.data;
}

export async function updateFijacionConfig(
  versionId: string,
  payload: Partial<Omit<FijacionConfig, 'id' | 'versionId'>>
): Promise<{ success: boolean; fijacionConfig: FijacionConfig }> {
  const response = await apiClient.patch<{ success: boolean; fijacionConfig: FijacionConfig }>(
    `/versiones/${versionId}/fijacion-config`,
    payload
  );
  return response.data;
}

export async function updatePresupuestoConfig(
  versionId: string,
  payload: Partial<Pick<PresupuestoConfig, 'textoPresentacion' | 'condicionesComerciales'>>
): Promise<{ success: boolean; presupuestoConfig: PresupuestoConfig }> {
  const response = await apiClient.patch<{ success: boolean; presupuestoConfig: PresupuestoConfig }>(
    `/versiones/${versionId}/presupuesto-config`,
    payload
  );
  return response.data;
}

export async function getConfiguracionEmpresa(): Promise<{ success: boolean; configuracionEmpresa: ConfiguracionEmpresa }> {
  const response = await apiClient.get<{ success: boolean; configuracionEmpresa: ConfiguracionEmpresa }>(
    '/configuracion-empresa'
  );
  return response.data;
}

export async function updateConfiguracionEmpresa(
  payload: Partial<Omit<ConfiguracionEmpresa, 'id'>>
): Promise<{ success: boolean; configuracionEmpresa: ConfiguracionEmpresa }> {
  const response = await apiClient.patch<{ success: boolean; configuracionEmpresa: ConfiguracionEmpresa }>(
    '/configuracion-empresa',
    payload
  );
  return response.data;
}

export async function updateVentanaPresupuesto(
  ventanaId: string,
  payload: Partial<Pick<Ventana, 'modelo' | 'comentarioPresupuesto'>>
): Promise<{ success: boolean; ventana: Ventana }> {
  const response = await apiClient.patch<{ success: boolean; ventana: Ventana }>(
    `/ventanas/${ventanaId}/presupuesto`,
    payload
  );
  return response.data;
}

// PDF generado en el servidor con Chromium real (page.pdf()), no con una
// captura armada en el navegador del cliente -- ver src/pdfRenderer.ts en el
// relay. Elimina la dependencia de que el dispositivo del cliente pinte a
// tiempo un DOM para poder rasterizarlo (causa del bug de paginas mezcladas
// en Safari/iOS).
export async function renderPdf(
  html: string,
  filename: string,
  headerFooter?: { headerTemplate?: string; footerTemplate?: string }
): Promise<Blob> {
  const response = await apiClient.post(
    '/pdf/render',
    { html, filename, ...headerFooter },
    { responseType: 'blob' }
  );
  return response.data;
}

export async function getClientes(q?: string): Promise<{ data: Cliente[] }> {
  const response = await apiClient.get<{ data: Cliente[] }>('/clientes', {
    params: q ? { q } : undefined,
  });
  return response.data;
}

export async function createCliente(payload: Partial<Cliente>): Promise<{ data: Cliente }> {
  const response = await apiClient.post<{ data: Cliente }>('/clientes', payload);
  return response.data;
}

export async function updateCliente(id: string, payload: Partial<Cliente>): Promise<{ data: Cliente }> {
  const response = await apiClient.patch<{ data: Cliente }>(`/clientes/${id}`, payload);
  return response.data;
}

// Solo administrador (ver requireAdmin en mtw-api) -- el backend responde
// 409 si el cliente todavia tiene proyectos enlazados.
export async function eliminarCliente(id: string): Promise<{ success: boolean }> {
  const response = await apiClient.post<{ success: boolean }>(`/clientes/${id}/eliminar`);
  return response.data;
}

// Config editable por partida (nombre + codigo de integracion Clay) --
// ver PartidaConfig en mtw-api.
export async function getPartidas(): Promise<{ data: PartidaConfig[] }> {
  const response = await apiClient.get<{ data: PartidaConfig[] }>('/partidas');
  return response.data;
}

// Solo administrador (ver requireAdmin en mtw-api).
export async function updatePartida(
  categoria: CategoriaGasto,
  payload: { nombre?: string; integracionClay?: string | null }
): Promise<{ success: boolean; partida: PartidaConfig }> {
  const response = await apiClient.patch<{ success: boolean; partida: PartidaConfig }>(`/partidas/${categoria}`, payload);
  return response.data;
}

export async function getMateriales(params?: {
  q?: string;
  familia?: string;
  proveedorId?: string;
  limit?: number;
}): Promise<Material[]> {
  // El catálogo vive en la tabla Material del relay, que el sync llena con
  // TODOS los materiales del presupuesto. No se puede reconstruir desde las
  // ventanas: HETMO sólo asocia el vidrio a su línea (linea_hetmo), mientras
  // que perfilería, herrajes, accesorios, refuerzos y juntas viajan con
  // linea_hetmo 0 y nunca llegan a MaterialVentana. Un respaldo armado desde
  // los proyectos devolvía, por eso, un maestro con puros vidrios.
  const response = await apiClient.get<any>('/materiales', { params });
  const resData = response.data;
  if (Array.isArray(resData)) return resData;
  if (Array.isArray(resData?.data)) return resData.data;
  if (Array.isArray(resData?.materiales)) return resData.materiales;
  return [];
}

export async function getMonedas(): Promise<
  { codigo: string; descripcion: string | null; simbolo: string | null; presupuestos?: number }[]
> {
  const response = await apiClient.get<any>('/monedas');
  const resData = response.data;
  if (Array.isArray(resData)) return resData;
  if (Array.isArray(resData?.data)) return resData.data;
  return [];
}

export async function createMaterial(payload: {
  skuInterno: string;
  descripcion: string;
  familia: string;
  unidadMedida: string;
  precioOrigen?: number | null;
  monedaOrigen?: string | null;
  proveedorId?: string | null;
}): Promise<{ data: Material } | Material> {
  const response = await apiClient.post<any>('/materiales', payload);
  return response.data;
}

export async function getProveedores(): Promise<{ data: Proveedor[] }> {
  const response = await apiClient.get<{ data: Proveedor[] }>('/proveedores');
  return response.data;
}

export async function createProveedor(nombre: string): Promise<{ data: Proveedor }> {
  const response = await apiClient.post<{ data: Proveedor }>('/proveedores', { nombre });
  return response.data;
}

export interface ProveedorFacturacionPayload {
  nombre?: string;
  rut?: string | null;
  nombreFantasia?: string | null;
  giroComercial?: string | null;
  direccion?: string | null;
  comuna?: string | null;
  region?: string | null;
  pais?: string | null;
  telefono?: string | null;
  sitioWeb?: string | null;
  contactoNombre?: string | null;
  email?: string | null;
  emailFacturacion?: string | null;
  emailPedidos?: string | null;
  emailAvisoPago?: string | null;
  condicionesPago?: string | null;
  banco?: string | null;
  tipoCuenta?: string | null;
  numeroCuenta?: string | null;
  monedaDefecto?: string | null;
  categoria?: string | null;
  ibanSwift?: string | null;
}

export async function updateProveedor(id: string, payload: ProveedorFacturacionPayload): Promise<{ data: Proveedor }> {
  const response = await apiClient.post<{ data: Proveedor }>(`/proveedores/${id}`, payload);
  return response.data;
}

// Solo administrador -- ver requireAdmin en mtw-api. Falla con 409 si el
// proveedor todavia tiene materiales u OC enlazados (hay que fusionarlo,
// no eliminarlo).
export async function eliminarProveedor(id: string): Promise<{ success: boolean }> {
  const response = await apiClient.post<{ success: boolean }>(`/proveedores/${id}/eliminar`);
  return response.data;
}

// Solo administrador -- reasigna todos los materiales/OC del proveedor
// origen (duplicado) al destino (el real) y elimina el origen.
export async function fusionarProveedor(id: string, proveedorDestinoId: string): Promise<{ success: boolean; data: Proveedor }> {
  const response = await apiClient.post<{ success: boolean; data: Proveedor }>(`/proveedores/${id}/fusionar`, { proveedorDestinoId });
  return response.data;
}

// POST, no PUT/DELETE -- son los unicos dos verbos de la API sin usar en
// ningun otro lado del cliente, y "Network Error" en panel.mtw.cl al
// guardar apunta a un bloqueo de metodo aguas arriba de Cloudflare Access.
export async function updateVentanaCorreccionGeometria(
  ventanaId: string,
  correccion: CorreccionGeometria | null
): Promise<{ success: boolean; data: Ventana; message?: string }> {
  const response = await apiClient.post<{ success: boolean; data: Ventana; message?: string }>(
    `/ventanas/${ventanaId}/correccion-geometria`,
    { correccion }
  );
  return response.data;
}

// Toggle: llamar de nuevo apaga el espejado. No hay endpoint /eliminar
// aparte -- a diferencia de correccion-geometria, acá no hay estado
// intermedio que decidir, solo prendido/apagado.
export async function espejarVentana(
  ventanaId: string
): Promise<{ success: boolean; data: Ventana; message?: string }> {
  const response = await apiClient.post<{ success: boolean; data: Ventana; message?: string }>(
    `/ventanas/${ventanaId}/espejar`
  );
  return response.data;
}

// Toggle de ordenPanelesInvertido -- mismo patrón que espejarVentana.
export async function invertirOrdenPanelesVentana(
  ventanaId: string
): Promise<{ success: boolean; data: Ventana; message?: string }> {
  const response = await apiClient.post<{ success: boolean; data: Ventana; message?: string }>(
    `/ventanas/${ventanaId}/invertir-orden-paneles`
  );
  return response.data;
}

// ==========================================
// ABASTECIMIENTO: ORDENES DE COMPRA Y BODEGA
// ==========================================
export async function getOrdenesCompra(params?: {
  proyectoId?: string;
  estado?: EstadoOC;
  proveedorId?: string;
  limit?: number;
  page?: number;
}): Promise<OrdenesCompraResponse> {
  const response = await apiClient.get<OrdenesCompraResponse>('/ordenes-compra', { params });
  return response.data;
}

export async function getOrdenCompraById(id: string): Promise<OrdenCompra> {
  const response = await apiClient.get<OrdenCompra>(`/ordenes-compra/${id}`);
  return response.data;
}

export interface ItemOrdenCompraPayload {
  materialId?: string | null;
  descripcion: string;
  unidadMedida?: string;
  cantidad: number;
  // Valor teorico antes de redondear a la unidad de compra (ver
  // OrdenCompraItem.cantidadCalculada) -- puramente informativo.
  cantidadCalculada?: number | null;
  // Obligatorio solo si la OC ya tiene proveedor (ver proveedorId abajo) --
  // una solicitud sin proveedor todavia puede no tener precio.
  precioUnitario?: number | null;
  // Obligatoria solo cuando el item no tiene materialId (partida externa)
  // -- con materialId, mtw-api la deriva sola de la familia.
  categoria?: CategoriaGasto;
}

export async function createOrdenCompra(payload: {
  // Sin proyectoId, la OC va al centro de costo GENERAL ("Obras Mayores")
  // -- ver resolverCentroCosto en mtw-api.
  proyectoId?: string | null;
  faseId?: string | null;
  // Sin proveedorId (solo posible con proyectoId), la OC nace como
  // SOLICITUD -- Compras la completa despues con
  // completarOrdenCompra/PATCH .../completar antes de poder pedirle
  // aprobación a Gerencia. Con proveedorId, nace ya completa.
  proveedorId?: string | null;
  // Toda OC nueva requiere aprobacion gerencial -- ya no es opcional,
  // mtw-api la fuerza siempre sin importar lo que se mande aca.
  moneda?: string;
  fechaCalendarizada?: string | null;
  comentarios?: string;
  items: ItemOrdenCompraPayload[];
  // Material que ya esta disponible en la bodega de Obras Mayores y se
  // reserva para este proyecto trasladandolo a su bodega al generar la OC
  // -- ver ejecutarTraslado en mtw-api. Ignorado si no hay proyectoId o si
  // la OC nace sin proveedor (una solicitud todavia no reserva nada).
  trasladosDesdeObrasMayores?: { materialId: string; cantidad: number }[];
}): Promise<{ success: boolean; ordenCompra: OrdenCompra }> {
  const response = await apiClient.post<{ success: boolean; ordenCompra: OrdenCompra }>('/ordenes-compra', payload);
  return response.data;
}

// Completa una solicitud (OC sin proveedor, nacida desde un Proyecto) con
// el proveedor, items y precios finales que decide Compras -- ver
// PATCH /api/ordenes-compra/:id/completar en mtw-api. Reemplaza los items
// enteros. Solo funciona mientras la OC sigue en BORRADOR.
export async function completarOrdenCompra(
  id: string,
  payload: {
    proveedorId: string;
    comentarios?: string;
    items: ItemOrdenCompraPayload[];
    trasladosDesdeObrasMayores?: { materialId: string; cantidad: number }[];
  }
): Promise<{ success: boolean; ordenCompra: OrdenCompra }> {
  const response = await apiClient.patch<{ success: boolean; ordenCompra: OrdenCompra }>(
    `/ordenes-compra/${id}/completar`,
    payload
  );
  return response.data;
}

export async function updateOrdenCompraEstado(
  id: string,
  estado: EstadoOC,
  motivoRechazo?: string
): Promise<{ success: boolean; ordenCompra: OrdenCompra }> {
  const response = await apiClient.patch<{ success: boolean; ordenCompra: OrdenCompra }>(`/ordenes-compra/${id}/estado`, {
    estado,
    motivoRechazo,
  });
  return response.data;
}

// Solo administrador (ver requireAdmin en mtw-api) -- borra la OC entera,
// incluida CANCELADA, y reversa el stock que haya ingresado por ella. El
// backend devuelve 409 (forzable: true) si ese stock ya se movio de
// Bodega o se borro a mano -- forzar=true salta esa validacion (nunca
// deja stock negativo, ver mtw-api).
export async function eliminarOrdenCompra(id: string, forzar?: boolean): Promise<{ success: boolean }> {
  const response = await apiClient.post<{ success: boolean }>(`/ordenes-compra/${id}/eliminar`, forzar ? { forzar: true } : undefined);
  return response.data;
}

// El "codigo" unico por item (ver RecepcionOCItem.numero en mtw-api) se
// genera solo -- la respuesta trae uno por item recien creado, listo para
// mostrar/rotular sin pedir de nuevo la OC completa.
export interface RecepcionOCItemCreado {
  id: string;
  ordenCompraItemId: string;
  codigo: string;
  cantidadRecibida: number;
}

export async function registrarRecepcionOC(
  ordenCompraId: string,
  payload: {
    tipoDocumentoId?: string;
    numeroDocumento?: string;
    notas?: string;
    items: { ordenCompraItemId: string; cantidadRecibida: number; precioReal?: number | null }[];
  }
): Promise<{ success: boolean; recepcion: Omit<RecepcionOC, 'items'> & { items: RecepcionOCItemCreado[] }; ordenCompra: OrdenCompra }> {
  const response = await apiClient.post(`/ordenes-compra/${ordenCompraId}/recepciones`, payload);
  return response.data;
}

// Catalogo chico para el selector de "Tipo de documento" al recepcionar
// una OC (Guía de Despacho, Factura, ...) -- ver TipoDocumento en mtw-api.
export async function getTiposDocumento(): Promise<{ data: TipoDocumento[] }> {
  const response = await apiClient.get<{ data: TipoDocumento[] }>('/tipos-documento');
  return response.data;
}

export async function getBodegaProyecto(proyectoId: string): Promise<BodegaProyectoResponse> {
  const response = await apiClient.get<BodegaProyectoResponse>(`/proyectos/${proyectoId}/bodega`);
  return response.data;
}

// Vista global de Bodega (todas las obras + "Obras Mayores" juntas) --
// para el modulo Bodega de primer nivel.
export async function getBodegaGlobal(): Promise<BodegaGlobalResponse> {
  const response = await apiClient.get<BodegaGlobalResponse>('/bodega');
  return response.data;
}

// Traslada stock de una bodega a otra (ej. desde "Obras Mayores" hacia la
// bodega de una obra puntual).
export async function trasladarBodega(
  bodegaId: string,
  payload: { materialId: string; cantidad: number; bodegaDestinoId: string; notas?: string }
): Promise<{ success: boolean; movimientoSalida: MovimientoBodega; movimientoEntrada: MovimientoBodega }> {
  const response = await apiClient.post(`/bodega/${bodegaId}/trasladar`, payload);
  return response.data;
}

export async function getUnidadesMaterial(bodegaId: string, materialId: string): Promise<UnidadesMaterialResponse> {
  const response = await apiClient.get<UnidadesMaterialResponse>(`/bodega/${bodegaId}/materiales/${materialId}/unidades`);
  return response.data;
}

// Solo administrador -- borra una fila de stock completa (y sus unidades
// individualizadas si corresponde). Limpieza directa para datos de
// prueba, no genera movimiento de kardex -- ver POST
// /api/bodega/stock/:id/eliminar en mtw-api.
export async function eliminarStockMaterial(stockId: string): Promise<{ success: boolean }> {
  const response = await apiClient.post<{ success: boolean }>(`/bodega/stock/${stockId}/eliminar`);
  return response.data;
}

export async function getSolicitudesMaterial(params?: {
  faseId?: string;
  proyectoId?: string;
  estado?: string;
}): Promise<{ data: SolicitudMaterial[] }> {
  const response = await apiClient.get<{ data: SolicitudMaterial[] }>('/solicitudes-material', { params });
  return response.data;
}

// Facturas recibidas en Clay para el proveedor de esta OC, sugeridas por
// cercania de monto -- no un match automatico, la persona confirma cual
// es con vincularFactura(). Falla con el error de mtw-api si el proveedor
// no tiene RUT cargado (necesario para buscar en Clay).
// Facturas de Clay SIN CONTABILIZAR, prefiltradas por RUT del proveedor y
// por monto (+-10% de lo que falta facturar) -- cada filtro se puede apagar.
export async function getFacturasSugeridas(
  ordenCompraId: string,
  filtros: FiltrosFacturas = { rut: true, monto: true }
): Promise<FacturasSugeridasResponse> {
  const response = await apiClient.get<FacturasSugeridasResponse>(`/ordenes-compra/${ordenCompraId}/facturas-sugeridas`, {
    params: { filtroRut: filtros.rut, filtroMonto: filtros.monto },
  });
  return response.data;
}

// Vista previa (sin escribir nada) de conciliar esta factura: como queda la
// OC y el asiento que se va a crear en Clay.
export async function getCheckoutFactura(
  ordenCompraId: string,
  clayTransactionId: string,
  permitirOtroRut = false
): Promise<CheckoutFactura> {
  const response = await apiClient.get<CheckoutFactura>(
    `/ordenes-compra/${ordenCompraId}/facturas/${encodeURIComponent(clayTransactionId)}/checkout`,
    { params: { permitirOtroRut } }
  );
  return response.data;
}

// Sube el XML original del SII de esta factura puntual y devuelve sus
// lineas reales + sugerencia de vinculo -- mismo shape que el checkout,
// pero sin depender de que Clay tenga el detalle (ver ClayDteLinea).
// xmlBase64: el archivo leido como ArrayBuffer y codificado en base64 (no
// como texto -- el XML puede venir en ISO-8859-1, el backend detecta la
// codificación real desde la declaración <?xml ... encoding=...?>).
export async function importarXmlFactura(
  ordenCompraId: string,
  clayTransactionId: string,
  xmlBase64: string,
  permitirOtroRut = false
): Promise<ImportarXmlResponse> {
  const response = await apiClient.post<ImportarXmlResponse>(
    `/ordenes-compra/${ordenCompraId}/facturas/${encodeURIComponent(clayTransactionId)}/importar-xml`,
    { xmlBase64, permitirOtroRut }
  );
  return response.data;
}

// Confirma el checkout: contabiliza la factura en Clay (con el token del
// usuario) y la vincula a la OC. modo "item": items es obligatorio (los
// vinculos que la persona confirmo/edito, desde las sugerencias del
// checkout o desde un XML importado). modo "monto": el mecanismo de antes
// (compara el neto total de la factura contra el de la OC), sin items.
// ajustarOC: en modo item, ajusta al monto vinculado los items que hayan
// quedado completos; en modo monto, escala TODOS los precios de la OC al
// monto facturado.
export async function vincularFactura(
  ordenCompraId: string,
  payload: {
    clayTransactionId: string;
    modo: 'item' | 'monto';
    items?: { ordenCompraItemId: string; descripcion: string; cantidad: number; monto: number }[];
    ajustarOC?: boolean;
    permitirOtroRut?: boolean;
    notas?: string;
  }
): Promise<{ success: boolean; conciliacion: ConciliacionFactura; estadoOC: EstadoOC; clayAsientoId: string }> {
  const response = await apiClient.post(`/ordenes-compra/${ordenCompraId}/facturas`, payload);
  return response.data;
}

// Cierre forzado de una OC PARCIALMENTE_CONCILIADA: lo que quedo sin
// vincular se da por no facturable.
export async function ajustarOCAFacturado(ordenCompraId: string): Promise<{ success: boolean; ordenCompra: OrdenCompra }> {
  const response = await apiClient.post(`/ordenes-compra/${ordenCompraId}/ajustar-a-facturado`);
  return response.data;
}

// Re-consulta esa factura en Clay y actualiza pagada/montoPagado -- nada
// dispara esto automaticamente todavia (sin cron ni webhook), es accion
// manual.
export async function refrescarConciliacion(conciliacionId: string): Promise<{ success: boolean; conciliacion: ConciliacionFactura }> {
  const response = await apiClient.post(`/conciliaciones/${conciliacionId}/refrescar`);
  return response.data;
}

export async function createSolicitudMaterial(
  faseId: string,
  payload: { items: { materialId: string; cantidadSolicitada: number }[]; notas?: string }
): Promise<{ success: boolean; solicitud: SolicitudMaterial }> {
  const response = await apiClient.post<{ success: boolean; solicitud: SolicitudMaterial }>(
    `/fases/${faseId}/solicitudes-material`,
    payload
  );
  return response.data;
}

export async function entregarSolicitudMaterial(
  id: string
): Promise<{ success: boolean; entregada: boolean; solicitud: SolicitudMaterial; faltantes?: any[] }> {
  const response = await apiClient.post(`/solicitudes-material/${id}/entregar`);
  return response.data;
}

export async function aprobarGerenciaSolicitud(
  id: string,
  aprobado: boolean,
  notas?: string
): Promise<{ success: boolean; solicitud: SolicitudMaterial }> {
  const response = await apiClient.patch(`/solicitudes-material/${id}/aprobar-gerencia`, { aprobado, notas });
  return response.data;
}

export async function deleteVentanaCorreccionGeometria(
  ventanaId: string
): Promise<{ success: boolean; data: Ventana; message?: string }> {
  const response = await apiClient.post<{ success: boolean; data: Ventana; message?: string }>(
    `/ventanas/${ventanaId}/correccion-geometria/eliminar`
  );
  return response.data;
}

// Materiales personalizados por línea (revisión de líneas): agregar un item
// del maestro a una línea, reemplazar un item HETMO de esa línea por otro
// del maestro, o deshacer cualquiera de los dos. Ver comentarios junto a
// los endpoints homónimos en mtw-api/src/index.ts.
export async function addVentanaMaterial(
  ventanaId: string,
  payload: { materialId: string; cantidad: number; piezas?: number | null; longitudMm?: number | null; acabado?: string | null }
): Promise<{ success: boolean; data: Ventana }> {
  const response = await apiClient.post<{ success: boolean; data: Ventana }>(
    `/ventanas/${ventanaId}/materiales`,
    payload
  );
  return response.data;
}

export async function reemplazarVentanaMaterial(
  ventanaId: string,
  payload: {
    materialIdOriginal: string;
    materialIdNuevo: string;
    cantidad: number;
    piezas?: number | null;
    longitudMm?: number | null;
    acabado?: string | null;
  }
): Promise<{ success: boolean; data: Ventana }> {
  const response = await apiClient.post<{ success: boolean; data: Ventana }>(
    `/ventanas/${ventanaId}/materiales/reemplazar`,
    payload
  );
  return response.data;
}

export async function eliminarVentanaMaterial(
  ventanaId: string,
  materialVentanaId: string
): Promise<{ success: boolean; data: Ventana }> {
  const response = await apiClient.post<{ success: boolean; data: Ventana }>(
    `/ventanas/${ventanaId}/materiales/${materialVentanaId}/eliminar`
  );
  return response.data;
}

// ==========================================
// PLANTILLAS DE LINEA (recetas de puertas Protex, ver Configuracion)
// ==========================================

export interface PlantillaLineaItemPayload {
  materialId: string;
  cantidad: number;
}

export async function getPlantillasLinea(): Promise<{ data: PlantillaLinea[] }> {
  const response = await apiClient.get<{ data: PlantillaLinea[] }>('/plantillas-linea');
  return response.data;
}

export async function createPlantillaLinea(payload: {
  nombre: string;
  tipo?: string;
  hojas?: 1 | 2;
  items: PlantillaLineaItemPayload[];
}): Promise<{ data: PlantillaLinea }> {
  const response = await apiClient.post<{ data: PlantillaLinea }>('/plantillas-linea', payload);
  return response.data;
}

export async function updatePlantillaLinea(
  id: string,
  payload: { nombre?: string; activa?: boolean; hojas?: 1 | 2; items?: PlantillaLineaItemPayload[] }
): Promise<{ data: PlantillaLinea }> {
  const response = await apiClient.post<{ data: PlantillaLinea }>(`/plantillas-linea/${id}`, payload);
  return response.data;
}

export async function eliminarPlantillaLinea(id: string): Promise<{ success: boolean }> {
  const response = await apiClient.post<{ success: boolean }>(`/plantillas-linea/${id}/eliminar`);
  return response.data;
}

// ==========================================
// LINEAS MANUALES (vidrio DVH fijo, puerta Protex...)
// ==========================================

export interface LineaManualPayload {
  versionId: string;
  tipo: 'DVH_FIJO' | 'PROTEX';
  anchoMm: number;
  altoMm: number;
  unidades: number;
  acabadoCodigo?: string | null;
  acabadoDescripcion?: string | null;
  comentarioPresupuesto?: string | null;
  materialVidrioId?: string;
  plantillaId?: string;
}

export async function crearLineaManual(payload: LineaManualPayload): Promise<{ success: boolean; data: Ventana }> {
  const response = await apiClient.post<{ success: boolean; data: Ventana }>('/ventanas/manual', payload);
  return response.data;
}

export async function eliminarLineaManual(ventanaId: string): Promise<{ success: boolean }> {
  const response = await apiClient.post<{ success: boolean }>(`/ventanas/${ventanaId}/eliminar-manual`);
  return response.data;
}

// ==========================================
// ROLES Y USUARIOS (control de acceso, ver Configuración > Roles de Usuario)
// ==========================================

export async function getMisPermisos(): Promise<MisPermisos> {
  const response = await apiClient.get<MisPermisos>('/mi-permisos');
  return response.data;
}

// "Editar mi usuario": solo el nombre propio (rol/correo/estado son del admin).
export async function updateMiUsuario(nombre: string): Promise<{ success: boolean; nombre: string }> {
  const response = await apiClient.patch('/mi-usuario', { nombre });
  return response.data;
}

// Token personal de Clay del usuario actual -- se valida contra Clay y se
// guarda cifrado; nunca vuelve al frontend.
export async function setMiClayToken(token: string): Promise<{ success: boolean; tieneTokenClay: boolean }> {
  const response = await apiClient.post('/mi-clay-token', { token });
  return response.data;
}

export async function deleteMiClayToken(): Promise<{ success: boolean; tieneTokenClay: boolean }> {
  const response = await apiClient.post('/mi-clay-token/eliminar');
  return response.data;
}

export async function getRoles(): Promise<{ data: Rol[] }> {
  const response = await apiClient.get<{ data: Rol[] }>('/roles');
  return response.data;
}

export async function createRol(payload: {
  nombre: string;
  secciones: string[];
  configTabs: string[];
  aprobaciones: string[];
}): Promise<{ data: Rol }> {
  const response = await apiClient.post<{ data: Rol }>('/roles', payload);
  return response.data;
}

export async function updateRol(
  id: string,
  payload: Partial<{ nombre: string; secciones: string[]; configTabs: string[]; aprobaciones: string[] }>
): Promise<{ data: Rol }> {
  const response = await apiClient.patch<{ data: Rol }>(`/roles/${id}`, payload);
  return response.data;
}

export async function getMisAprobacionesPendientes(): Promise<AprobacionesPendientes> {
  const response = await apiClient.get<AprobacionesPendientes>('/mis-aprobaciones-pendientes');
  return response.data;
}

// POST, no DELETE -- ver comentario junto a eliminarProyecto sobre Cloudflare Access.
export async function eliminarRol(id: string): Promise<{ success: boolean }> {
  const response = await apiClient.post<{ success: boolean }>(`/roles/${id}/eliminar`);
  return response.data;
}

export async function getUsuarios(): Promise<{ data: Usuario[] }> {
  const response = await apiClient.get<{ data: Usuario[] }>('/usuarios');
  return response.data;
}

export async function createUsuario(payload: {
  nombre: string;
  email: string;
  rolId?: string | null;
}): Promise<{ data: Usuario }> {
  const response = await apiClient.post<{ data: Usuario }>('/usuarios', payload);
  return response.data;
}

export async function updateUsuario(
  id: string,
  payload: Partial<{ nombre: string; email: string; rolId: string | null; activo: boolean }>
): Promise<{ data: Usuario }> {
  const response = await apiClient.patch<{ data: Usuario }>(`/usuarios/${id}`, payload);
  return response.data;
}

// ---- Control de Pendientes ----

export async function getPendientes(proyectoId: string): Promise<ObraPendiente[]> {
  const response = await apiClient.get<ObraPendiente[]>(`/proyectos/${proyectoId}/pendientes`);
  return response.data;
}

export async function getPendiente(id: string): Promise<ObraPendienteDetalle> {
  const response = await apiClient.get<ObraPendienteDetalle>(`/pendientes/${id}`);
  return response.data;
}

export async function crearPendiente(proyectoId: string, payload: NuevoPendientePayload): Promise<ObraPendiente> {
  const response = await apiClient.post<ObraPendiente>(`/proyectos/${proyectoId}/pendientes`, payload);
  return response.data;
}

// Pasa el pendiente de estado. EN_CURSO + etapaId elige/cambia la etapa; solo
// quien creo el pendiente (o un administrador) puede resolverlo o reabrirlo.
export async function cambiarEstadoPendiente(
  id: string,
  payload: { estado: EstadoPendiente; etapaId?: string; comentario?: string }
): Promise<ObraPendiente> {
  const response = await apiClient.patch<ObraPendiente>(`/pendientes/${id}/estado`, payload);
  return response.data;
}

// POST y no DELETE: Cloudflare Access bloquea DELETE/PUT en produccion.
export async function eliminarPendiente(id: string): Promise<void> {
  await apiClient.post(`/pendientes/${id}/eliminar`);
}

export async function getEtapasPendiente(todas = false): Promise<EtapaPendiente[]> {
  const response = await apiClient.get<EtapaPendiente[]>('/pendientes-etapas', { params: todas ? { todas: 1 } : undefined });
  return response.data;
}

export async function crearEtapaPendiente(payload: { nombre: string; destino?: DestinoPendiente | null }): Promise<EtapaPendiente> {
  const response = await apiClient.post<EtapaPendiente>('/pendientes-etapas', payload);
  return response.data;
}

export async function editarEtapaPendiente(
  id: string,
  payload: { nombre?: string; destino?: DestinoPendiente | null; orden?: number; activa?: boolean }
): Promise<EtapaPendiente> {
  const response = await apiClient.patch<EtapaPendiente>(`/pendientes-etapas/${id}`, payload);
  return response.data;
}

// ---- Adjuntos de pendientes (OneDrive) ----

export async function getOneDriveObra(proyectoId: string): Promise<OneDriveObra> {
  const response = await apiClient.get<OneDriveObra>(`/proyectos/${proyectoId}/onedrive`);
  return response.data;
}

export async function buscarCarpetasOneDrive(proyectoId: string, q: string): Promise<CarpetaOneDriveSugerida[]> {
  const response = await apiClient.get<CarpetaOneDriveSugerida[]>(`/proyectos/${proyectoId}/onedrive/carpetas`, { params: q ? { q } : undefined });
  return response.data;
}

// Vincula la obra a una carpeta existente ({ carpetaId }) o crea una nueva ({ crear: true, nombre }).
export async function vincularCarpetaOneDrive(
  proyectoId: string,
  payload: { carpetaId: string } | { crear: true; nombre?: string }
): Promise<CarpetaOneDrive> {
  const response = await apiClient.post<{ carpeta: CarpetaOneDrive }>(`/proyectos/${proyectoId}/onedrive/carpeta`, payload);
  return response.data.carpeta;
}

export async function desvincularCarpetaOneDrive(proyectoId: string): Promise<void> {
  await apiClient.post(`/proyectos/${proyectoId}/onedrive/desvincular`);
}

// Sube el archivo tal cual en el cuerpo (sin multipart); el nombre va en la URL.
export async function subirAdjuntoPendiente(pendienteId: string, archivo: Blob, nombre: string, mime: string): Promise<AdjuntoPendiente> {
  const response = await apiClient.post<AdjuntoPendiente>(`/pendientes/${pendienteId}/adjuntos`, archivo, {
    params: { nombre },
    headers: { 'Content-Type': mime },
    timeout: 120000,
  });
  return response.data;
}

export async function getContenidoAdjunto(pendienteId: string, adjuntoId: string): Promise<Blob> {
  const response = await apiClient.get<Blob>(`/pendientes/${pendienteId}/adjuntos/${adjuntoId}/contenido`, { responseType: 'blob', timeout: 120000 });
  return response.data;
}

export async function quitarAdjuntoPendiente(pendienteId: string, adjuntoId: string): Promise<void> {
  await apiClient.post(`/pendientes/${pendienteId}/adjuntos/${adjuntoId}/quitar`);
}

// ---- Configuracion de OneDrive (conexion con la cuenta central) ----

export async function getOneDriveEstado(probar = false): Promise<OneDriveEstado> {
  const response = await apiClient.get<OneDriveEstado>('/onedrive/estado', { params: probar ? { probar: 1 } : undefined });
  return response.data;
}

// Devuelve la URL de Microsoft a la que hay que mandar al administrador para iniciar sesion.
export async function iniciarConexionOneDrive(): Promise<string> {
  const response = await apiClient.get<{ url: string }>('/onedrive/conexion/iniciar');
  return response.data.url;
}

export async function guardarCarpetaRaizOneDrive(carpetaRaiz: string): Promise<{ carpetaRaiz: string; existe: boolean }> {
  const response = await apiClient.patch<{ carpetaRaiz: string; existe: boolean }>('/onedrive/configuracion', { carpetaRaiz });
  return response.data;
}

export async function desconectarOneDrive(): Promise<void> {
  await apiClient.post('/onedrive/desconectar');
}

// ---- Cubicador ----

export async function getCubicacion(proyectoId: string): Promise<{ cubicacion: Cubicacion | null; resumen: ResumenCubicacion | null }> {
  const response = await apiClient.get(`/proyectos/${proyectoId}/cubicacion`);
  return response.data;
}

export async function crearCubicacion(proyectoId: string, payload: { holguraMm?: number; formatoNomenclatura?: string } = {}) {
  const response = await apiClient.post<{ cubicacion: Cubicacion; resumen: ResumenCubicacion }>(`/proyectos/${proyectoId}/cubicacion`, payload);
  return response.data;
}

export async function actualizarCubicacion(proyectoId: string, payload: { nombre?: string; holguraMm?: number; formatoNomenclatura?: string }) {
  const response = await apiClient.patch<{ cubicacion: Cubicacion; resumen: ResumenCubicacion }>(`/proyectos/${proyectoId}/cubicacion`, payload);
  return response.data;
}

// Importa la planilla (.xlsx) tal cual en el cuerpo. No pisa lo ya trabajado.
export async function importarPlanillaCubicacion(proyectoId: string, archivo: Blob) {
  const response = await apiClient.post<{ reporte: ReporteImportacionCubicacion; cubicacion: Cubicacion; resumen: ResumenCubicacion }>(
    `/proyectos/${proyectoId}/cubicacion/importar`,
    archivo,
    { headers: { 'Content-Type': 'application/octet-stream' }, timeout: 180000 }
  );
  return response.data;
}

export async function getTiposCubicacion(proyectoId: string): Promise<TipoCubicacion[]> {
  const response = await apiClient.get<TipoCubicacion[]>(`/proyectos/${proyectoId}/cubicacion/tipos`);
  return response.data;
}

export type DatosTipoCubicacion = {
  codigo?: string;
  sistema?: string;
  anchoPlanoMm?: number | null;
  altoPlanoMm?: number | null;
  cuadros?: number | null;
  precioUnitario?: number | null;
  cantidadContratada?: number;
  holguraMm?: number | null;
  esAreaComun?: boolean;
};

export async function crearTipoCubicacion(proyectoId: string, payload: DatosTipoCubicacion & { codigo: string; sistema: string }) {
  const response = await apiClient.post(`/proyectos/${proyectoId}/cubicacion/tipos`, payload);
  return response.data;
}

export async function editarTipoCubicacion(id: string, payload: DatosTipoCubicacion) {
  const response = await apiClient.patch(`/cubicacion-tipos/${id}`, payload);
  return response.data;
}

export async function eliminarTipoCubicacion(id: string): Promise<void> {
  await apiClient.post(`/cubicacion-tipos/${id}/eliminar`);
}

export async function getUnidadesCubicacion(proyectoId: string, filtro: FiltroUnidadesCubicacion = {}): Promise<{ total: number; unidades: UnidadCubicacion[] }> {
  const params: Record<string, string | number> = {};
  if (filtro.piso !== undefined && filtro.piso !== '') params.piso = filtro.piso;
  if (filtro.torre) params.torre = filtro.torre;
  if (filtro.tipoId) params.tipoId = filtro.tipoId;
  if (filtro.q?.trim()) params.q = filtro.q.trim();
  if (filtro.sinRectificar) params.sinRectificar = 1;
  if (filtro.areasComunes) params.areasComunes = 1;
  if (filtro.limit) params.limit = filtro.limit;
  const response = await apiClient.get(`/proyectos/${proyectoId}/cubicacion/unidades`, { params });
  return response.data;
}

export async function getUbicacionesCubicacion(proyectoId: string): Promise<{ torres: string[]; pisos: number[] }> {
  const response = await apiClient.get(`/proyectos/${proyectoId}/cubicacion/ubicaciones`);
  return response.data;
}

export type DatosUnidadCubicacion = {
  tipoId?: string;
  torre?: string | null;
  piso?: number | null;
  dpto?: number | null;
  ubicacion?: string | null;
  apertura?: string | null;
  rasgoAnchoMm?: number | null;
  rasgoAltoMm?: number | null;
};

export async function crearUnidadCubicacion(proyectoId: string, payload: DatosUnidadCubicacion & { tipoId: string }): Promise<UnidadCubicacion> {
  const response = await apiClient.post<UnidadCubicacion>(`/proyectos/${proyectoId}/cubicacion/unidades`, payload);
  return response.data;
}

export async function editarUnidadCubicacion(id: string, payload: DatosUnidadCubicacion): Promise<UnidadCubicacion> {
  const response = await apiClient.patch<UnidadCubicacion>(`/cubicacion-unidades/${id}`, payload);
  return response.data;
}

export async function eliminarUnidadCubicacion(id: string): Promise<void> {
  await apiClient.post(`/cubicacion-unidades/${id}/eliminar`);
}

// Informe Excel para crear la fase en HETMO (nomenclatura + medidas de fabricacion).
export async function descargarInformeCubicacion(proyectoId: string, filtro: { piso?: number | ''; torre?: string; soloRectificadas?: boolean } = {}): Promise<Blob> {
  const params: Record<string, string | number> = {};
  if (filtro.piso !== undefined && filtro.piso !== '') params.piso = filtro.piso;
  if (filtro.torre) params.torre = filtro.torre;
  if (filtro.soloRectificadas) params.soloRectificadas = 1;
  const response = await apiClient.get<Blob>(`/proyectos/${proyectoId}/cubicacion/informe`, { params, responseType: 'blob', timeout: 120000 });
  return response.data;
}
