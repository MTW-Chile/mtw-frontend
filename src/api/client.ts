import axios from 'axios';
import type { ProyectosResponse, Proyecto, SyncLog } from '../types';

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