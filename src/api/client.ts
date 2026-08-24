import axios from 'axios';
import type { ProyectosResponse, Proyecto, SyncLog, Cliente } from '../types';

const serviceToken = import.meta.env.VITE_SERVICE_TOKEN;

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
    ...(serviceToken ? { Authorization: `Bearer ${serviceToken}` } : {}),
  },
  timeout: 25000,
});

export async function getProyectos(params?: {
  page?: number;
  limit?: number;
  estado?: number;
  q?: string;
}): Promise<ProyectosResponse> {
  const { data } = await apiClient.get<ProyectosResponse>('/proyectos', { params });
  return data;
}

export async function getProyectoById(id: string): Promise<Proyecto> {
  const { data } = await apiClient.get<Proyecto>(`/proyectos/${id}`);
  return data;
}

export async function getSyncLogs(limit = 10): Promise<SyncLog[]> {
  const { data } = await apiClient.get<SyncLog[]>('/sync/logs', { params: { limit } });
  return data;
}

export async function triggerManualSync(forceUpdate = false) {
  const { data } = await apiClient.post('/sync/run', { forceUpdate });
  return data;
}

export async function updateVersionConfig(
  versionId: string,
  payload: {
    tipoCambioDolar?: number | null;
    tipoCambioUF?: number | null;
    tipoCambioEuro?: number | null;
    estadoAprobacion?: string;
    esCongelado?: boolean;
  }
) {
  const { data } = await apiClient.patch(`/versiones/${versionId}/config`, payload);
  return data;
}

export async function updateProyectoCliente(proyectoId: string, clienteId: string) {
  const { data } = await apiClient.patch(`/proyectos/${proyectoId}/cliente`, { clienteId });
  return data;
}

export async function createFase(versionId: string, payload: {
  nombre: string;
  numeroFase: number;
  descripcion?: string;
  fechaInicio?: string;
  fechaEntrega?: string;
  ventanas?: { ventanaId: string; unidades: number; notas?: string }[];
}) {
  const { data } = await apiClient.post(`/versiones/${versionId}/fases`, payload);
  return data;
}

export async function saveMaterialAjuste(versionId: string, payload: {
  materialId: string;
  precioPersonalizado?: number | null;
  monedaPersonalizada?: string | null;
  familiaPersonalizada?: string | null;
  excluido?: boolean;
}) {
  const { data } = await apiClient.post(`/versiones/${versionId}/material-ajustes`, payload);
  return data;
}

export async function getClientes(q?: string): Promise<{ data: Cliente[] }> {
  const { data } = await client.get<{ data: Cliente[] }>('/clientes', {
    params: q ? { q } : undefined,
  });
  return data;
}

export async function createCliente(payload: Partial<Cliente>): Promise<{ data: Cliente }> {
  const { data } = await client.post<{ data: Cliente }>('/clientes', payload);
  return data;
}
