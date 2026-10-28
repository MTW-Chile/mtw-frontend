import React from 'react';
import { HeaderSeccion } from '../../../components/layout/HeaderSeccion';
import { PAGE_CONTAINER_CLASS } from '../../../lib/designSystem';
import { PendientesTab } from './PendientesTab';

/**
 * Pendientes (Comercial, Taller y Abastecimiento): visor central con los pendientes
 * de todas las obras, como Compras con las OC. Se crean desde cada obra.
 */
export const PendientesPage: React.FC = () => (
  <div className={PAGE_CONTAINER_CLASS}>
    <HeaderSeccion titulo="Pendientes" />
    <PendientesTab />
  </div>
);
