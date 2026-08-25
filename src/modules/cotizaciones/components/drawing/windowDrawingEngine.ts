import type { Ventana } from '../../../../types';

export interface WindowFinishColors {
  frame: string;
  frameStroke: string;
  sash: string;
  sashStroke: string;
  glass: string;
  glassStroke: string;
  symbolColor: string;
}

export function getFinishColors(acabado?: string | null): WindowFinishColors {
  const code = (acabado || '').toLowerCase().trim();
  
  if (code.includes('roble') || code.includes('golden') || code.includes('madera')) {
    return {
      frame: '#B47230',
      frameStroke: '#78350F',
      sash: '#C8853F',
      sashStroke: '#5B2907',
      glass: '#E0F2FE',
      glassStroke: '#BAE6FD',
      symbolColor: '#1D4ED8',
    };
  }
  
  if (code.includes('nogal') || code.includes('walnut') || code.includes('oscuro')) {
    return {
      frame: '#5C3A21',
      frameStroke: '#382314',
      sash: '#6E4628',
      sashStroke: '#28180E',
      glass: '#E0F2FE',
      glassStroke: '#BAE6FD',
      symbolColor: '#38BDF8',
    };
  }
  
  if (code.includes('antracita') || code.includes('grafito') || code.includes('gris') || code.includes('7016')) {
    return {
      frame: '#374151',
      frameStroke: '#1F2937',
      sash: '#4B5563',
      sashStroke: '#111827',
      glass: '#E0F2FE',
      glassStroke: '#BAE6FD',
      symbolColor: '#38BDF8',
    };
  }
  
  if (code.includes('negro') || code.includes('black') || code.includes('9005')) {
    return {
      frame: '#18181B',
      frameStroke: '#09090B',
      sash: '#27272A',
      sashStroke: '#000000',
      glass: '#E0F2FE',
      glassStroke: '#BAE6FD',
      symbolColor: '#60A5FA',
    };
  }

  // Por defecto: Blanco / Estándar
  return {
    frame: '#F1F5F9',
    frameStroke: '#CBD5E1',
    sash: '#FFFFFF',
    sashStroke: '#94A3B8',
    glass: '#E0F2FE',
    glassStroke: '#BAE6FD',
    symbolColor: '#2563EB',
  };
}

export type WindowApertureType = 
  | 'fixed' 
  | 'sliding-2' 
  | 'sliding-3' 
  | 'sliding-4' 
  | 'hinged-left' 
  | 'hinged-right' 
  | 'tilt-turn-left' 
  | 'tilt-turn-right' 
  | 'projecting' 
  | 'double-door';

export function detectApertureType(ventana: Ventana): WindowApertureType {
  const code = ventana.dibujoTipoApertura || 0;
  const leaves = ventana.numeroCuadrosHojas || 1;
  const desc = (ventana.descripcionCorta || ventana.modelo || '').toLowerCase();

  // Fijo
  if (code === 0 || desc.includes('fijo') || desc.includes('paño fijo')) {
    return 'fixed';
  }

  // Proyectante
  if (code === 7 || code === 8 || desc.includes('proyect')) {
    return 'projecting';
  }

  // Oscilobatiente
  if (code === 13 || code === 21 || desc.includes('oscilobatiente') || desc.includes('o/b')) {
    return desc.includes('izq') ? 'tilt-turn-left' : 'tilt-turn-right';
  }

  // Puerta o doble batiente
  if (code === 23 || code === 31 || desc.includes('doble') || leaves === 2 && desc.includes('puerta')) {
    return 'double-door';
  }

  // Practicable / Batiente
  if (code === 17 || code === 18 || desc.includes('practicable') || desc.includes('batiente')) {
    return desc.includes('izq') || code === 18 ? 'hinged-left' : 'hinged-right';
  }

  // Correderas
  if (code >= 32 && code <= 47 || desc.includes('corred') || desc.includes('desliz')) {
    if (leaves === 4 || code === 38 || code === 41 || code === 44) return 'sliding-4';
    if (leaves === 3 || code === 36) return 'sliding-3';
    return 'sliding-2';
  }

  if (leaves === 4) return 'sliding-4';
  if (leaves === 3) return 'sliding-3';
  if (leaves === 2) return 'sliding-2';

  return 'fixed';
}
