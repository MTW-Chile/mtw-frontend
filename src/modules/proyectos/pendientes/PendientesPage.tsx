import React from 'react';
import { HeaderSeccion } from '../../../components/layout/HeaderSeccion';
import { PAGE_CONTAINER_CLASS } from '../../../lib/designSystem';
import { PendientesTab } from './PendientesTab';
import type { AreaPendiente } from './utils';

/**
 * Visor central de pendientes de todas las obras. Es la misma pantalla en tres secciones del menú: Comercial ve todos;
 * Taller (`area="FABRICA"`), los de marcos, hojas y ventanas; Abastecimiento (`area="COMPRAS"`), los de vidrios y
 * materiales. En el visor de su área, abrir un pendiente lo deja «Recibido». Se ingresan desde Instaladores › Pendientes.
 */
export const PendientesPage: React.FC<{ area?: AreaPendiente }> = ({ area }) => (
  <div className={PAGE_CONTAINER_CLASS}>
    <HeaderSeccion titulo={area === 'FABRICA' ? 'Pendientes de fábrica' : area === 'COMPRAS' ? 'Pendientes de compras' : 'Pendientes'} />
    <PendientesTab key={area ?? 'todos'} area={area} />
  </div>
);
