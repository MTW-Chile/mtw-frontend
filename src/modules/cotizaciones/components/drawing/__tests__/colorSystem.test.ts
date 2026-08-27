import { describe, it, expect } from 'vitest';
import { getFrameColor, createFinish, FINISH_MAP } from '../colorSystem';

describe('FINISH_MAP — sin alias numéricos sin verificar', () => {
  // Los códigos numéricos puros son los que usa el proveedor (Tecnocom
  // Perfiles) en vez de un código HETMO con nombre corto. Se retiraron los
  // que eran adivinanzas sin forma de verificar; sólo quedan los confirmados
  // contra un caso real de HETMO (ver comentario junto a cada uno en
  // FINISH_MAP). Esta lista es la única fuente de "confirmados" -- un
  // numérico nuevo que no esté acá hace fallar el test a propósito, para que
  // agregarlo sea una decisión explícita, no un descuido.
  const numericosConfirmados = ['5', '6', '6997', '7000', '7020', '7040', '7075', '7130', '7279', '7310', '7320'];

  it('no contiene claves numéricas sin verificar contra un caso real', () => {
    const numericKeys = Object.keys(FINISH_MAP).filter(k => /^\d+$/.test(k));
    expect(numericKeys.sort()).toEqual(numericosConfirmados.sort());
  });

  it('no resuelve "NOV" a un color inventado; cae al patrón "nogal" (marrón real)', () => {
    const color = getFrameColor('NOV', 'Nogal Vintage');
    expect(color).not.toBe('#7250a0');
    expect(color.toLowerCase()).not.toBe('#7250a0');
  });
});

describe('getFrameColor — fallback a acabado de materiales', () => {
  it('usa el acabado de un material cuando la ventana no trae código/descripción/patrón', () => {
    const withMaterial = getFrameColor(undefined, undefined, undefined, ['negro mate']);
    const withoutAny = getFrameColor(undefined, undefined, undefined, []);
    expect(withMaterial).not.toBe(withoutAny);
  });

  it('prioriza el acabado propio de la ventana sobre el de los materiales', () => {
    const color = getFrameColor('BL', undefined, undefined, ['negro']);
    expect(color).toBe(FINISH_MAP['BL']);
  });
});

describe('createFinish — propaga materialAcabados a getFrameColor', () => {
  it('resuelve un color de marco usando sólo el acabado de los materiales', () => {
    const finish = createFinish(undefined, undefined, undefined, ['blanco']);
    expect(finish.frame).toBe(getFrameColor(undefined, undefined, undefined, ['blanco']));
  });
});
