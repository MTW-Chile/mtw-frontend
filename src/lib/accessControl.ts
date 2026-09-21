import type { ElementType } from 'react';
import { LayoutDashboard, Boxes, Building2, FolderKanban, Settings, FileText, DoorClosed, ShieldCheck } from 'lucide-react';

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
  { id: 'maestro', label: 'Maestro de Materiales', icon: Boxes },
  { id: 'cotizaciones', label: 'Cotizaciones', icon: Building2 },
  { id: 'proyectos', label: 'Proyectos', icon: FolderKanban },
  { id: 'configuracion', label: 'Configuración', icon: Settings },
];

// Pestañas dentro del modulo Configuración. "roles-usuario" es la que se
// agrega en esta misma tanda -- el panel que la implementa (RolesUsuarioPanel)
// se auto-restringe a ADMIN_EMAILS del lado del backend/frontend, sin
// importar si un rol llegara a tener este id marcado por error.
export const CONFIG_TABS: EntradaAcceso[] = [
  { id: 'presupuesto', label: 'Presupuesto', icon: FileText },
  { id: 'plantillas-puertas', label: 'Plantillas de Puertas', icon: DoorClosed },
  { id: 'roles-usuario', label: 'Roles de Usuario', icon: ShieldCheck },
];
