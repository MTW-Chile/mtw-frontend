import type { ElementType } from 'react';
import { LayoutDashboard, Building, Building2, FolderKanban, Settings, FileText, DoorClosed, ShieldCheck, Warehouse, ShoppingCart, Users, ListChecks, Cloud, Boxes, SlidersHorizontal, Tags, Calculator, Ruler, Workflow, ClipboardList, Factory, Briefcase, Hammer, Truck, Megaphone, HardHat } from 'lucide-react';
import type { Permiso } from '../types';

export interface EntradaAcceso {
  id: string;
  label: string;
  icon: ElementType;
  // Se muestra si el usuario tiene AL MENOS UNO de estos permisos (catalogo de
  // mtw-api). La API exige lo mismo en sus rutas: ocultar aca es solo UX.
  permisos: Permiso[];
  // Visible en el menú pero aún sin construir: abre un aviso.
  enConstruccion?: boolean;
}

// Secciones del Sidebar y pestañas de Configuración, con el permiso que las
// habilita. Agregar una sección o pestaña es agregarla aquí con su permiso
// (y, si es nueva, declarar ese permiso en el catálogo de mtw-api).

// Secciones de Configuración, agrupadas en su menú lateral (también definen
// si se ve la sección Configuración). El id va en la URL (?tab=...).
export interface SeccionConfig extends EntradaAcceso {
  grupo: 'Empresa' | 'Comercial' | 'Catálogo' | 'Obras' | 'Sistema';
  descripcion: string;
}

export const CONFIG_SECCIONES: SeccionConfig[] = [
  { grupo: 'Empresa', id: 'empresa', label: 'Configuración de Empresa', icon: Building, permisos: ['config.empresa'], descripcion: 'Datos de la empresa y logo de los documentos.' },
  { grupo: 'Empresa', id: 'anuncio', label: 'Anuncio', icon: Megaphone, permisos: ['config.empresa'], descripcion: 'Mensaje para todos los usuarios en la página de inicio.' },
  { grupo: 'Comercial', id: 'parametros', label: 'Parámetros', icon: SlidersHorizontal, permisos: ['config.comercial'], descripcion: 'IVA, tasas, Hoja de Fijación por defecto, aprobación de adicionales y conciliación.' },
  { grupo: 'Comercial', id: 'tipos-proyecto', label: 'Tipos de proyecto', icon: FolderKanban, permisos: ['config.comercial'], descripcion: 'Obra, retail y otros: definen las plantillas de textos que usa cada documento.' },
  { grupo: 'Comercial', id: 'plantillas-textos', label: 'Plantillas de textos', icon: FileText, permisos: ['config.comercial'], descripcion: 'Presentación y condiciones comerciales de presupuestos y adicionales.' },
  { grupo: 'Catálogo', id: 'tipos-producto', label: 'Tipos de producto', icon: Boxes, permisos: ['config.catalogo'], descripcion: 'Cómo se calcula, valoriza y compra cada material.' },
  { grupo: 'Catálogo', id: 'partidas', label: 'Partidas', icon: Tags, permisos: ['config.catalogo'], descripcion: 'Partidas de presupuesto y su correlativo de Clay.' },
  { grupo: 'Catálogo', id: 'hoja-fijacion', label: 'Hoja de Fijación', icon: Calculator, permisos: ['config.catalogo'], descripcion: 'Conceptos de la Hoja de Fijación y su partida por defecto.' },
  { grupo: 'Catálogo', id: 'unidades', label: 'Unidades', icon: Ruler, permisos: ['config.catalogo'], descripcion: 'Unidades de medida de compra y consumo.' },
  { grupo: 'Catálogo', id: 'familias-hetmo', label: 'Familias HETMO', icon: Workflow, permisos: ['config.catalogo'], descripcion: 'Correspondencia entre familias de HETMO y tipos de producto.' },
  { grupo: 'Catálogo', id: 'plantillas-puertas', label: 'Plantillas de puertas', icon: DoorClosed, permisos: ['config.catalogo'], descripcion: 'Recetas de herrajes Protex.' },
  { grupo: 'Obras', id: 'etapas-pendientes', label: 'Etapas de pendientes', icon: ListChecks, permisos: ['config.obras'], descripcion: 'Etapas por las que pasa un pendiente de obra.' },
  { grupo: 'Sistema', id: 'roles-usuario', label: 'Roles y usuarios', icon: ShieldCheck, permisos: ['usuarios.ver'], descripcion: 'Quién entra y qué puede hacer.' },
  { grupo: 'Sistema', id: 'onedrive', label: 'OneDrive', icon: Cloud, permisos: ['config.integraciones'], descripcion: 'Conexión para guardar documentos de obra.' },
];

// URLs anteriores al menú agrupado (?tab=catalogo&sub=partidas, etc.).
export const CONFIG_ALIAS: Record<string, string> = {
  presupuesto: 'empresa',
  comercial: 'parametros',
  'comercial/parametros': 'parametros',
  'comercial/tipos': 'tipos-proyecto',
  'comercial/plantillas': 'plantillas-textos',
  catalogo: 'tipos-producto',
  'catalogo/tipos': 'tipos-producto',
  'catalogo/partidas': 'partidas',
  'catalogo/fijacion': 'hoja-fijacion',
  'catalogo/unidades': 'unidades',
  'catalogo/familias': 'familias-hetmo',
};

// Lo ve cualquiera que entra al ERP (Inicio y las secciones en construcción).
const PERMISOS_GENERALES: Permiso[] = ['presupuestos.ver', 'obras.ver', 'compras.ver', 'bodega.ver', 'clientes.ver'];

export const SECCIONES_FRONTEND: EntradaAcceso[] = [
  { id: 'inicio', label: 'Inicio', icon: LayoutDashboard, permisos: PERMISOS_GENERALES },
  { id: 'clientes', label: 'Clientes', icon: Users, permisos: ['clientes.ver'] },
  { id: 'proveedores', label: 'Proveedores', icon: Building, permisos: ['catalogo.ver'] },
  // El id sigue siendo 'cotizaciones' (URLs y enlaces de correo existentes);
  // solo cambia el nombre visible.
  { id: 'cotizaciones', label: 'Presupuestos', icon: Building2, permisos: ['presupuestos.ver'] },
  // Igual: el id sigue siendo 'proyectos'.
  { id: 'proyectos', label: 'Obras en curso', icon: FolderKanban, permisos: ['obras.ver'] },
  { id: 'pendientes', label: 'Pendientes en obra', icon: ClipboardList, permisos: ['pendientes.ver'] },
  // Fabricación: las obras en curso vistas desde el taller (cubicación, fases,
  // documentos de fabricación y despachos a obra).
  { id: 'fabricacion', label: 'Fabricación', icon: Factory, permisos: ['obras.ver'] },
  // Instalación: el Supervisor de Instalación recibe despachos y certifica la instalación.
  { id: 'instalacion', label: 'Instalación', icon: HardHat, permisos: ['instalacion.ver'] },
  { id: 'compras', label: 'Compras', icon: ShoppingCart, permisos: ['compras.ver'] },
  { id: 'bodega', label: 'Bodega', icon: Warehouse, permisos: ['bodega.ver'] },
  { id: 'maestro', label: 'Maestro de materiales', icon: Boxes, permisos: ['catalogo.ver'] },
  { id: 'contabilidad', label: 'Contabilidad', icon: Calculator, permisos: PERMISOS_GENERALES, enConstruccion: true },
  { id: 'configuracion', label: 'Configuración', icon: Settings, permisos: CONFIG_SECCIONES.flatMap((t) => t.permisos) },
];

/**
 * Menú lateral: entradas sueltas y grupos que se despliegan. Una sección puede
 * estar en más de un grupo (Pendientes en obra en Comercial y en Taller).
 * Configuración va siempre fijada abajo, fuera de esta lista.
 */
export type EntradaMenu = { tipo: 'seccion'; id: string } | { tipo: 'grupo'; id: string; titulo: string; icon: ElementType; secciones: string[] };

export const MENU_LATERAL: EntradaMenu[] = [
  { tipo: 'seccion', id: 'inicio' },
  { tipo: 'grupo', id: 'comercial', titulo: 'Comercial', icon: Briefcase, secciones: ['clientes', 'proveedores', 'cotizaciones', 'proyectos', 'pendientes'] },
  { tipo: 'grupo', id: 'taller', titulo: 'Taller', icon: Hammer, secciones: ['fabricacion', 'instalacion', 'pendientes'] },
  { tipo: 'grupo', id: 'abastecimiento', titulo: 'Abastecimiento', icon: Truck, secciones: ['compras', 'bodega', 'maestro'] },
  { tipo: 'seccion', id: 'contabilidad' },
];

export function entradaVisible(entrada: EntradaAcceso, tieneAlguno: (...permisos: Permiso[]) => boolean): boolean {
  return tieneAlguno(...entrada.permisos);
}
