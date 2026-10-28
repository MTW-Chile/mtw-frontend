import React from 'react';
import { HeaderSlot } from './HeaderSlot';

// Cabecera estándar de una sección de primer nivel: las acciones van al
// Header del sitio (portal). El título lo muestran las migas del Header en
// todos los anchos. Sin contador: la cantidad de elementos se ve en la lista.
export const HeaderSeccion: React.FC<{ titulo: string; acciones?: React.ReactNode }> = ({ acciones }) => (
  <HeaderSlot>{acciones && <div className="ml-auto flex items-center gap-1.5 sm:gap-2 shrink-0">{acciones}</div>}</HeaderSlot>
);
