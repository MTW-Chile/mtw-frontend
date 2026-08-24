import axios from 'axios';
import type { ProyectosResponse, Proyecto, SyncLog, Cliente } from '../types';

const serviceToken = import.meta.env.VITE_SERVICE_TOKEN;

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
    ...(serviceToken ? { Authorization: `Bearer ${serviceToken}` } : {}),
  },
});

export async function getProyectos(params?: {
  skip?: number;
  limit?: number;
  estado?: number;
}): Promise<ProyectosResponse> {
  const response = await apiClient.get<any>('/proyectos', { params });
  return response.data;
}

export async function getProyectoById(id: string): Promise<Proyecto> {
  const response = await apiClient.get<any>(`/proyectos/${id}`);
  // Soporta tanto { data: proyecto } como proyecto directo
  return response.data?.data || response.data;
}

export async function getSyncLogs(limit = 10): Promise<SyncLog[]> {
  const response = await apiClient.get<any>('/sync/logs', {
    params: { limit },
  });
  return response.data?.data || response.data;
}

export async function triggerManualSync(forceUpdate = false): Promise<{ status: string; message: string }> {
  const response = await apiClient.post<any>('/sync/run', {
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
): Promise<{ data: any }> {
  const response = await apiClient.patch<any>(`/versiones/${id}/config`, payload);
  return response.data;
}

export async function updateProyectoCliente(
  id: string,
  clienteId: string | null
): Promise<{ data: Proyecto }> {
  const response = await apiClient.patch<any>(`/proyectos/${id}/cliente`, { clienteId });
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
): Promise<{ data: any }> {
  const response = await apiClient.post<any>(`/versiones/${versionId}/fases`, payload);
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
): Promise<{ data: any }> {
  const response = await apiClient.post<any>(`/versiones/${versionId}/material-ajustes`, payload);
  return response.data;
}

export async function getClientes(q?: string): Promise<{ data: Cliente[] }> {
  const response = await apiClient.get<any>('/clientes', {
    params: q ? { q } : undefined,
  });
  if (Array.isArray(response.data)) {
    return { data: response.data };
  }
  return response.data?.data ? response.data : { data: [] };
}

export async function createCliente(payload: Partial<Cliente>): Promise<{ data: Cliente }> {
  const response = await apiClient.post<any>('/clientes', payload);
  return response.data;
}
