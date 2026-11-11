import { describe, expect, it } from 'vitest';
import { REGIONES_CHILE, comunaCanonica, comunasDeRegion, lineaDireccion, regionDeComuna } from './chile';

describe('regiones y comunas de Chile', () => {
  it('trae las 16 regiones y las 346 comunas, sin repetir', () => {
    const comunas = REGIONES_CHILE.flatMap((r) => r.comunas);
    expect(REGIONES_CHILE).toHaveLength(16);
    expect(comunas).toHaveLength(346);
    expect(new Set(comunas).size).toBe(346);
  });

  it('encuentra la región de una comuna aunque venga sin tildes o en mayúsculas', () => {
    expect(regionDeComuna('Las Condes')).toBe('Metropolitana de Santiago');
    expect(regionDeComuna('VIÑA DEL MAR')).toBe('Valparaíso');
    expect(regionDeComuna('concepcion')).toBe('Biobío');
    expect(regionDeComuna('Las Condes, Santiago')).toBeNull();
    expect(regionDeComuna(null)).toBeNull();
  });

  it('devuelve el nombre de la comuna como está en el catálogo', () => {
    expect(comunaCanonica(' nunoa ')).toBe('Ñuñoa');
    expect(comunaCanonica('Stgo')).toBeNull();
  });

  it('lista las comunas de una región en orden alfabético', () => {
    const rm = comunasDeRegion('Metropolitana de Santiago');
    expect(rm).toHaveLength(52);
    expect(rm[0]).toBe('Alhué');
    expect(comunasDeRegion('No existe')).toEqual([]);
  });

  it('arma la dirección en una línea sin repetir la ciudad', () => {
    expect(lineaDireccion({ direccion: 'Av. Apoquindo 5550', comuna: 'Las Condes', ciudad: 'Santiago' })).toBe('Av. Apoquindo 5550, Las Condes, Santiago');
    expect(lineaDireccion({ direccion: 'Calle 1', comuna: 'Coyhaique', ciudad: 'Coyhaique' })).toBe('Calle 1, Coyhaique');
    expect(lineaDireccion({ direccion: null, comuna: null, ciudad: null })).toBe('');
  });
});
