import axios from 'axios';
import type { ProyectosResponse, Proyecto, SyncLog } from '../types';

// Obtener URL base de variable de entorno o fallback a producción
const DEFAULT_API_URL = 'https://mtw-relay-api-production.up.railway.app/api';
export const API_BASE_URL = import.meta.env.VITE_API_URL || DEFAULT_API_URL;

// Obtener Service Token desde variable de entorno o localStorage para pruebas en vivo
export const getServiceToken = (): string => {
  return (
    localStorage.getItem('MTW_SERVICE_TOKEN') ||
    import.meta.env.VITE_SERVICE_TOKEN ||
    import.meta.env.VITE_API_KEY ||
    ''
  );
};

export const setServiceToken = (token: string): void => {
  if (token) {
    localStorage.setItem('MTW_SERVICE_TOKEN', token.trim());
  } else {
    localStorage.removeItem('MTW_SERVICE_TOKEN');
  }
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 25000,
});

// Interceptor para inyectar Service Token dinámicamente en cada petición
apiClient.interceptors.request.use((config) => {
  const token = getServiceToken();
  if (token) {
    config.headers['x-service-token'] = token;
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
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