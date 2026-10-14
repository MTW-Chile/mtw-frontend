import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/** Id del contenedor que el Header del sitio deja libre para el contexto de la pantalla abierta. */
export const HEADER_SLOT_ID = 'header-contexto';

/**
 * Pone `children` dentro del Header del sitio (a la derecha de las migas).
 * Cada pantalla lo usa para llevar ahí su título secundario, contadores y
 * acciones en vez de dibujar una cabecera propia debajo -- así hay un solo
 * header. El slot es un flex con gap-2 dentro de un @container (el Header): para adaptar a
 * cada ancho usar variantes de contenedor (`@3xl:`, `@5xl:`) y no las de
 * viewport, porque el Sidebar le quita 256px al header desde `lg`. Usar `ml-auto` en un hijo para
 * empujar un grupo (ej. las acciones) al borde derecho.
 */
export const HeaderSlot: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setSlot(document.getElementById(HEADER_SLOT_ID));
  }, []);
  return slot ? createPortal(children, slot) : null;
};
