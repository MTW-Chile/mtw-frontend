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
  SyncLog,
  Cliente,
  Material,
  Proveedor,
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
}): Promise<ProyectosResponse> {
  const response = await apiClient.get<ProyectosResponse>('/proyectos', { params });
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
  // El relay actualiza con include: { cliente: true } solamente - la respuesta
  // no trae "versiones" (a diferencia de GET /proyectos/:id).
  const response = await apiClient.patch<{ success: boolean; proyecto: Omit<Proyecto, 'versiones'> }>(
    `/proyectos/${id}/cliente`,
    { clienteId }
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
    numeroFase: number;
    nombre: string;
    descripcion?: string;
    ventanas: { ventanaId: string; unidades: number; notas?: string }[];
  }
): Promise<{ success: boolean; fase: Fase }> {
  const response = await apiClient.post<{ success: boolean; fase: Fase }>(
    `/versiones/${versionId}/fases`,
    payload
  );
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

export async function getMateriales(params?: {
  q?: string;
  familia?: string;
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

export async function updateVentanaCorreccionGeometria(
  ventanaId: string,
  correccion: CorreccionGeometria | null
): Promise<{ success: boolean; data: Ventana; message?: string }> {
  const response = await apiClient.put<{ success: boolean; data: Ventana; message?: string }>(
    `/ventanas/${ventanaId}/correccion-geometria`,
    { correccion }
  );
  return response.data;
}

export async function deleteVentanaCorreccionGeometria(
  ventanaId: string
): Promise<{ success: boolean; data: Ventana; message?: string }> {
  const response = await apiClient.delete<{ success: boolean; data: Ventana; message?: string }>(
    `/ventanas/${ventanaId}/correccion-geometria`
  );
  return response.data;
}



