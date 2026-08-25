import axios from 'axios';
import type { ProyectosResponse, Proyecto, ProyectoVersion, Fase, ProyectoMaterialAjuste, SyncLog, Cliente } from '../types';

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
