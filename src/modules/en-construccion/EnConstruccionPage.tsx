import React from 'react';
import { Construction } from 'lucide-react';
import { HeaderSeccion } from '../../components/layout/HeaderSeccion';
import { EstadoVacio } from '../../components/ui/Estados';
import { PAGE_CONTAINER_CLASS } from '../../lib/designSystem';

const DESCRIPCION: Record<string, string> = {
  contabilidad: 'El módulo de Contabilidad. Mientras tanto, la conciliación de facturas con Clay está en Compras.',
  reportes: 'Indicadores de producción, ventas, compras y obra calculados con lo que el ERP ya registra.',
};

/** Sección visible en el menú pero aún por construir. */
export const EnConstruccionPage: React.FC<{ seccion: string; titulo: string }> = ({ seccion, titulo }) => (
  <div className={PAGE_CONTAINER_CLASS}>
    <HeaderSeccion titulo={titulo} />
    <EstadoVacio icono={Construction} titulo={`${titulo}: en construcción`} descripcion={DESCRIPCION[seccion]} />
  </div>
);
