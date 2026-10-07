import type { ElementType } from 'react';
import { LayoutDashboard, Boxes, Building2, FolderKanban, Settings, FileText, DoorClosed, ShieldCheck, Wrench, Landmark, Warehouse, ShoppingCart, Users, ListChecks, Cloud } from 'lucide-react';

export interface EntradaAcceso {
  id: string;
  label: string;
  icon: ElementType;
}

// Fuente unica de verdad de las secciones del frontend (Sidebar) y las
// pestañas de Configuración -- Sidebar.tsx, ConfiguracionPage.tsx y el
// panel de Roles de Usuario (RolesUsuarioPanel.tsx) leen de aca. Agregar
// una seccion o pestaña nueva es tocar SOLO esta lista: aparece sola tanto
// en la navegación como en las opciones asignables a un rol, sin tener que
// modificar el panel de Roles cada vez.
export const SECCIONES_FRONTEND: EntradaAcceso[] = [
  { id: 'inicio', label: 'Inicio', icon: LayoutDashboard },
  { id: 'clientes', label: 'Clientes', icon: Users },
  // El id sigue siendo 'cotizaciones' (permisos por rol, URLs y enlaces de
  // correo existentes); solo cambia el nombre visible.
  { id: 'cotizaciones', label: 'Presupuestos', icon: Building2 },
  { id: 'proyectos', label: 'Obras', icon: FolderKanban },
  { id: 'compras', label: 'Compras', icon: ShoppingCart },
  { id: 'bodega', label: 'Bodega', icon: Warehouse },
  { id: 'maestro', label: 'Maestro de Materiales', icon: Boxes },
  { id: 'configuracion', label: 'Configuración', icon: Settings },
];

// Pestañas dentro del modulo Configuración. "roles-usuario" es la que se
// agrega en esta misma tanda -- el panel que la implementa (RolesUsuarioPanel)
// se auto-restringe a ADMIN_EMAILS del lado del backend/frontend, sin
// importar si un rol llegara a tener este id marcado por error.
export const CONFIG_TABS: EntradaAcceso[] = [
  { id: 'presupuesto', label: 'Presupuesto', icon: FileText },
  { id: 'plantillas-puertas', label: 'Plantillas de Puertas', icon: DoorClosed },
  { id: 'etapas-pendientes', label: 'Etapas de pendientes', icon: ListChecks },
  { id: 'onedrive', label: 'OneDrive', icon: Cloud },
  { id: 'roles-usuario', label: 'Roles de Usuario', icon: ShieldCheck },
];

// Que puede aprobar un rol -- permisos ESTRICTAMENTE separados (decisión
// explícita): 'tecnico' no habilita 'gerencial' ni viceversa. El
// administrador del sistema (ADMIN_EMAILS en mtw-api) siempre puede las
// dos, sin pasar por esto. Ver requireAprobador en mtw-api/src/index.ts.
export const ROLES_APROBACION: EntradaAcceso[] = [
  { id: 'tecnico', label: 'Aprobación Técnica (Analítica de Materiales y Presupuestos)', icon: Wrench },
  { id: 'gerencial', label: 'Aprobación Gerencial (paso final de Presupuestos y OC)', icon: Landmark },
];
