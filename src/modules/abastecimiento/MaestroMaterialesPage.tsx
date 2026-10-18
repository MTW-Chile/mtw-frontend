import React from 'react';
import { HeaderSeccion } from '../../components/layout/HeaderSeccion';
import { PAGE_CONTAINER_CLASS } from '../../lib/designSystem';
import { MaestroProductos } from '../cotizaciones/components/MaestroProductos';

/**
 * Abastecimiento › Maestro de materiales: catálogo con SKU, tipo, formato y
 * precio. Las reglas de cada tipo se configuran en Configuración › Catálogo.
 */
export const MaestroMaterialesPage: React.FC = () => (
  <div className={PAGE_CONTAINER_CLASS}>
    <HeaderSeccion titulo="Maestro de materiales" />
    <MaestroProductos />
  </div>
);
