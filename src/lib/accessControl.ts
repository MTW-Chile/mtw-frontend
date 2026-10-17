import type { ElementType } from 'react';
import { LayoutDashboard, Building2, FolderKanban, Settings, FileText, DoorClosed, ShieldCheck, Warehouse, ShoppingCart, Users, ListChecks, Cloud } from 'lucide-react';
import type { Permiso } from '../types';

export interface EntradaAcceso {
  id: string;
  label: string;
  icon: ElementType;
  // Se muestra si el usuario tiene AL MENOS UNO de estos permisos (catalogo de
  // mtw-api). La API exige lo mismo en sus rutas: ocultar aca es solo UX.
  permisos: Permiso[];
}

// Secciones del Sidebar y pestañas de Configuración, con el permiso que las
// habilita. Agregar una sección o pestaña es agregarla aquí con su permiso
// (y, si es nueva, declarar ese permiso en el catálogo de mtw-api).

// Pestañas de Configuración (también definen si se ve la sección Configuración).
export const CONFIG_TABS: EntradaAcceso[] = [
  { id: 'presupuesto', label: 'Presupuesto', icon: FileText, permisos: ['config.empresa'] },
  { id: 'plantillas-puertas', label: 'Plantillas de Puertas', icon: DoorClosed, permisos: ['config.catalogo'] },
  { id: 'etapas-pendientes', label: 'Etapas de pendientes', icon: ListChecks, permisos: ['config.obras'] },
  { id: 'onedrive', label: 'OneDrive', icon: Cloud, permisos: ['config.integraciones'] },
  { id: 'roles-usuario', label: 'Roles de Usuario', icon: ShieldCheck, permisos: ['usuarios.ver'] },
];

export const SECCIONES_FRONTEND: EntradaAcceso[] = [
  {
    id: 'inicio',
    label: 'Inicio',
    icon: LayoutDashboard,
    permisos: ['presupuestos.ver', 'obras.ver', 'compras.ver', 'bodega.ver', 'clientes.ver'],
  },
  { id: 'clientes', label: 'Clientes', icon: Users, permisos: ['clientes.ver'] },
  // El id sigue siendo 'cotizaciones' (URLs y enlaces de correo existentes);
  // solo cambia el nombre visible.
  { id: 'cotizaciones', label: 'Presupuestos', icon: Building2, permisos: ['presupuestos.ver'] },
  { id: 'proyectos', label: 'Obras', icon: FolderKanban, permisos: ['obras.ver'] },
  { id: 'compras', label: 'Compras', icon: ShoppingCart, permisos: ['compras.ver'] },
  { id: 'bodega', label: 'Bodega', icon: Warehouse, permisos: ['bodega.ver'] },
  { id: 'configuracion', label: 'Configuración', icon: Settings, permisos: CONFIG_TABS.flatMap((t) => t.permisos) },
];

export function entradaVisible(entrada: EntradaAcceso, tieneAlguno: (...permisos: Permiso[]) => boolean): boolean {
  return tieneAlguno(...entrada.permisos);
}
