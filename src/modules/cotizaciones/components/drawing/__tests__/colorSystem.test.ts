import { describe, it, expect } from 'vitest';
import { getFrameColor, createFinish, FINISH_MAP } from '../colorSystem';

describe('FINISH_MAP — sin alias numéricos sin verificar', () => {
  it('no contiene claves puramente numéricas (IDs internos, no códigos HETMO reales)', () => {
    const numericKeys = Object.keys(FINISH_MAP).filter(k => /^\d+$/.test(k));
    expect(numericKeys).toEqual([]);
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
