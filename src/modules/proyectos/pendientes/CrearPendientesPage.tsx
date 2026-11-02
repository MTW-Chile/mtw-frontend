import React from 'react';
import type { Proyecto } from '../../../types';
import { EspacioVentanas } from '../obra/EspacioVentanas';

/**
 * Nuevos pendientes de una obra: se eligen ventanas de la cubicación, se detalla cada pendiente con la ventana a la
 * vista, se van juntando en un listado y se envían todos de una vez. Es el mismo espacio de trabajo que Instalación
 * (ver EspacioVentanas), solo con la acción «Pendiente».
 */
export const CrearPendientesPage: React.FC<{ proyecto: Proyecto; onCerrar: () => void }> = ({ proyecto, onCerrar }) => (
  <EspacioVentanas proyecto={proyecto} modo="pendientes" onCerrar={onCerrar} />
);
