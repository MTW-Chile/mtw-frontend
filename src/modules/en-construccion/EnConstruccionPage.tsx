import React from 'react';
import { Construction } from 'lucide-react';
import { HeaderSeccion } from '../../components/layout/HeaderSeccion';
import { EstadoVacio } from '../../components/ui/Estados';
import { PAGE_CONTAINER_CLASS } from '../../lib/designSystem';

const DESCRIPCION: Record<string, string> = {
  fabricacion: 'La vista de Fabricación para el taller, según los permisos de su rol. Mientras tanto, los documentos de fabricación están en cada obra.',
  contabilidad: 'El módulo de Contabilidad. Mientras tanto, la conciliación de facturas con Clay está en Compras.',
};

/** Sección visible en el menú pero aún por construir. */
export const EnConstruccionPage: React.FC<{ seccion: string; titulo: string }> = ({ seccion, titulo }) => (
  <div className={PAGE_CONTAINER_CLASS}>
    <HeaderSeccion titulo={titulo} />
    <EstadoVacio icono={Construction} titulo={`${titulo}: en construcción`} descripcion={DESCRIPCION[seccion]} />
  </div>
);
