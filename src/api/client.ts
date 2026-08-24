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
  const { data } = await apiClient.get<ProyectosResponse>('/proyectos', { params });
  return data;
}

export async function getProyectoById(id: string): Promise<Proyecto> {
  const { data } = await apiClient.get<{ data: Proyecto }>(`/proyectos/${id}`);
  return data.data;
}

export async function getSyncLogs(limit = 10): Promise<SyncLog[]> {
  const { data } = await apiClient.get<{ data: SyncLog[] }>('/sync/logs', {
    params: { limit },
  });
  return data.data;
}

export async function triggerManualSync(forceUpdate = false): Promise<{ status: string; message: string }> {
  const { data } = await apiClient.post<{ status: string; message: string }>('/sync/run', {
    forceUpdate,
  });
  return data;
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
  const { data } = await apiClient.patch<{ data: any }>(`/versiones/${id}/config`, payload);
  return data;
}

export async function updateProyectoCliente(
  id: string,
  clienteId: string | null
): Promise<{ data: Proyecto }> {
  const { data } = await apiClient.patch<{ data: Proyecto }>(`/proyectos/${id}/cliente`, { clienteId });
  return data;
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
  const { data } = await apiClient.post<{ data: any }>(`/versiones/${versionId}/fases`, payload);
  return data;
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
  const { data } = await apiClient.post<{ data: any }>(`/versiones/${versionId}/material-ajustes`, payload);
  return data;
}

export async function getClientes(q?: string): Promise<{ data: Cliente[] }> {
  const { data } = await apiClient.get<{ data: Cliente[] }>('/clientes', {
    params: q ? { q } : undefined,
  });
  return data;
}

export async function createCliente(payload: Partial<Cliente>): Promise<{ data: Cliente }> {
  const { data } = await apiClient.post<{ data: Cliente }>('/clientes', payload);
  return data;
}
