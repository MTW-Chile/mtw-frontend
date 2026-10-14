import { describe, it, expect } from 'vitest';
import {
  TAMANO_MAXIMO_ADJUNTO,
  debeReducir,
  dimensionesReducidas,
  formatoTamano,
  mimeDeArchivo,
  nombreComoJpg,
  problemaAlElegir,
  problemaDeArchivo,
} from './utils';

describe('mimeDeArchivo', () => {
  it('usa el del navegador si viene', () => {
    expect(mimeDeArchivo('a.jpg', 'image/jpeg')).toBe('image/jpeg');
    expect(mimeDeArchivo('a.JPG', 'IMAGE/JPEG')).toBe('image/jpeg');
  });
  it('si viene vacio o generico, deduce por la extension (HEIC del iPhone, algunos Android)', () => {
    expect(mimeDeArchivo('IMG_1.HEIC', '')).toBe('image/heic');
    expect(mimeDeArchivo('plano.pdf', 'application/octet-stream')).toBe('application/pdf');
    expect(mimeDeArchivo('cuadro.xlsx', '')).toContain('spreadsheetml');
  });
  it('extension desconocida: no inventa', () => {
    expect(mimeDeArchivo('virus.exe', '')).toBe('');
    expect(mimeDeArchivo('sinextension', '')).toBe('');
  });
});

describe('problemaDeArchivo', () => {
  it('acepta fotos y documentos', () => {
    expect(problemaDeArchivo('a.jpg', 'image/jpeg', 1000)).toBeNull();
    expect(problemaDeArchivo('a.pdf', 'application/pdf', 1000)).toBeNull();
  });
  it('rechaza tipo, vacio y exceso de tamaño', () => {
    expect(problemaDeArchivo('a.exe', 'application/x-msdownload', 10)).toMatch(/no permitido/);
    expect(problemaDeArchivo('a.jpg', 'image/jpeg', 0)).toMatch(/vacío/);
    expect(problemaDeArchivo('gran.jpg', 'image/jpeg', TAMANO_MAXIMO_ADJUNTO + 1)).toMatch(/máximo es 20 MB/);
  });
});

describe('dimensionesReducidas', () => {
  it('no toca lo que ya cabe', () => {
    expect(dimensionesReducidas(1920, 1080)).toBeNull();
    expect(dimensionesReducidas(800, 600)).toBeNull();
  });
  it('mantiene la proporcion con el lado mayor en el maximo', () => {
    expect(dimensionesReducidas(4000, 3000)).toEqual({ ancho: 1920, alto: 1440 });
    expect(dimensionesReducidas(3000, 4000)).toEqual({ ancho: 1440, alto: 1920 });
  });
  it('datos invalidos: no reduce', () => {
    expect(dimensionesReducidas(0, 5000)).toBeNull();
  });
});

describe('debeReducir', () => {
  it('solo fotos decodificables y pesadas', () => {
    expect(debeReducir('image/jpeg', 5 * 1024 * 1024)).toBe(true);
    expect(debeReducir('image/jpeg', 200 * 1024)).toBe(false);
    expect(debeReducir('image/heic', 5 * 1024 * 1024)).toBe(false);
    expect(debeReducir('application/pdf', 15 * 1024 * 1024)).toBe(false);
  });
});

describe('formato', () => {
  it('tamaño legible', () => {
    expect(formatoTamano(500)).toBe('500 B');
    expect(formatoTamano(2048)).toBe('2 KB');
    expect(formatoTamano(5.5 * 1024 * 1024)).toBe('5.5 MB');
  });
  it('nombre del archivo reducido', () => {
    expect(nombreComoJpg('IMG 001.png')).toBe('IMG 001.jpg');
    expect(nombreComoJpg('foto.tar.heic')).toBe('foto.tar.jpg');
    expect(nombreComoJpg('')).toBe('foto.jpg');
  });
});

describe('problemaAlElegir', () => {
  it('deja pasar una foto pesada (se reduce antes de subir)', () => {
    expect(problemaAlElegir('a.jpg', 'image/jpeg', 30 * 1024 * 1024)).toBeNull();
  });
  it('un PDF pesado si se rechaza, y una foto absurda tambien', () => {
    expect(problemaAlElegir('a.pdf', 'application/pdf', 30 * 1024 * 1024)).toMatch(/máximo/);
    expect(problemaAlElegir('a.jpg', 'image/jpeg', 200 * 1024 * 1024)).toMatch(/máximo/);
  });
});
