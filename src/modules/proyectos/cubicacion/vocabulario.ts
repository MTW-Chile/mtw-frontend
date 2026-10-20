import type { ModoCubicacion } from '../../../types';

// Palabras del cubicador según cómo se cubica la obra (se define en el tipo de proyecto). La estructura es la
// misma, Torre → Piso → Unidad, y por dentro se sigue llamando así; solo cambia lo que ve la persona:
// un edificio habla de torres y departamentos, una casa (Retail, Condominio) de casas y recintos.
export interface Vocabulario {
  modo: ModoCubicacion;
  /** "Torre A" / "Casa C2"; sin nombre: "Sin torre" / "Casa única". */
  textoTorre: (nombre: string) => string;
  /** "torre" / "casa", para frases ("¿Quitar la torre …?"). */
  contenedor: string;
  /** Con artículo: "la torre" / "la casa". */
  elContenedor: string;
  /** "departamento" / "recinto". */
  unidad: string;
  unidades: string;
  /** "depto" / "recinto", para botones y campos cortos. */
  unidadCorta: string;
  armar: string;
  ampliar: string;
  agregarContenedor: string;
  tituloVacio: string;
  textoVacio: string;
  ayuda: string;
}

const EDIFICIO: Vocabulario = {
  modo: 'EDIFICIO',
  textoTorre: (nombre) => (nombre === '' ? 'Sin torre' : `Torre ${nombre}`),
  contenedor: 'torre',
  elContenedor: 'la torre',
  unidad: 'departamento',
  unidades: 'departamentos',
  unidadCorta: 'depto',
  armar: 'Armar el edificio',
  ampliar: 'Ampliar el edificio',
  agregarContenedor: 'Agregar torre',
  tituloVacio: 'Aún no hay torres, pisos ni departamentos.',
  textoVacio: 'Crea la estructura de una vez (por ejemplo 2 torres de 12 pisos con 6 departamentos) y luego ve ubicando las ventanas.',
  ayuda:
    'Arma el edificio y ubica cada ventana. Arrastra un tipo de la izquierda a un departamento (o elige uno y usa + 1); arrastra una ventana a otro departamento para moverla, o de vuelta a la izquierda para sacarla. Es la misma información que la planilla Excel.',
};

const CASA: Vocabulario = {
  modo: 'CASA',
  textoTorre: (nombre) => (nombre === '' ? 'Casa única' : `Casa ${nombre}`),
  contenedor: 'casa',
  elContenedor: 'la casa',
  unidad: 'recinto',
  unidades: 'recintos',
  unidadCorta: 'recinto',
  armar: 'Armar la casa',
  ampliar: 'Agregar pisos y recintos',
  agregarContenedor: 'Agregar otra casa',
  tituloVacio: 'Aún no hay casa, pisos ni recintos.',
  textoVacio: 'Arma la casa de una vez (sus pisos y sus recintos: living, cocina, dormitorios…) y luego ve ubicando las ventanas. Si hay más casas iguales, cópiala después.',
  ayuda:
    'Arma la casa y ubica cada ventana en su recinto. Arrastra un tipo de la izquierda a un recinto (o elige uno y usa + 1); arrastra una ventana a otro recinto para moverla, o de vuelta a la izquierda para sacarla. Con varias casas iguales, usa «Copiar casa».',
};

export const vocabulario = (modo: ModoCubicacion | undefined): Vocabulario => (modo === 'CASA' ? CASA : EDIFICIO);

/** Recintos que se sugieren al armar una casa (nombres cortos: forman parte de la nomenclatura de la ventana). */
export const RECINTOS_SUGERIDOS = ['ESTAR', 'COMEDOR', 'COCINA', 'DORM 1', 'DORM 2', 'DORM 3', 'BAÑO 1', 'BAÑO 2', 'LOGGIA', 'TERRAZA'];
