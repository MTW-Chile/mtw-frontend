import React from 'react';
import { HeaderSeccion } from '../../components/layout/HeaderSeccion';
import { PAGE_CONTAINER_CLASS } from '../../lib/designSystem';
import { ProveedoresPanel } from '../cotizaciones/components/ProveedoresPanel';

/** Comercial › Proveedores: datos de facturación de cada proveedor (antes dentro del Maestro). */
export const ProveedoresPage: React.FC = () => (
  <div className={PAGE_CONTAINER_CLASS}>
    <HeaderSeccion titulo="Proveedores" />
    <ProveedoresPanel />
  </div>
);
