import React from 'react';
import { REGIONES_CHILE, comunasDeRegion, regionDeComuna } from '../../lib/chile';
import { Input } from './Input';
import { Select } from './Select';

export interface ValorDireccion {
  direccion: string;
  region: string;
  comuna: string;
  ciudad: string;
}

export const DIRECCION_VACIA: ValorDireccion = { direccion: '', region: '', comuna: '', ciudad: '' };

/** Arma el valor del formulario desde lo guardado (null → ''); si falta la región, se deduce de la comuna. */
export function aValorDireccion(d: { direccion?: string | null; region?: string | null; comuna?: string | null; ciudad?: string | null }): ValorDireccion {
  return {
    direccion: d.direccion ?? '',
    region: d.region || regionDeComuna(d.comuna) || '',
    comuna: d.comuna ?? '',
    ciudad: d.ciudad ?? '',
  };
}

interface Props {
  valor: ValorDireccion;
  onChange: (valor: ValorDireccion) => void;
  etiquetaDireccion?: string;
  placeholderDireccion?: string;
  ayudaDireccion?: string;
  direccionRequerida?: boolean;
  disabled?: boolean;
}

/**
 * Dirección en el formato del SII (el que piden facturas, guías de despacho y
 * OC): dirección, comuna y ciudad. La región se elige primero y deja en
 * «Comuna» solo las de esa región. Un valor guardado antes de existir el
 * catálogo (texto libre) se conserva como opción hasta que se cambie.
 */
export const CamposDireccion: React.FC<Props> = ({ valor, onChange, etiquetaDireccion = 'Dirección', placeholderDireccion, ayudaDireccion, direccionRequerida, disabled }) => {
  const region = valor.region || regionDeComuna(valor.comuna) || '';
  const comunas = comunasDeRegion(region);
  const regionFueraDeCatalogo = !!region && !REGIONES_CHILE.some((r) => r.nombre === region);
  const comunaFueraDeCatalogo = !!valor.comuna && !comunas.includes(valor.comuna);

  const cambiarRegion = (nueva: string) => {
    const sigue = comunasDeRegion(nueva).includes(valor.comuna);
    onChange({ ...valor, region: nueva, comuna: sigue ? valor.comuna : '' });
  };

  return (
    <div className="space-y-3.5">
      <Input
        label={etiquetaDireccion}
        value={valor.direccion}
        onChange={(e) => onChange({ ...valor, direccion: e.target.value })}
        placeholder={placeholderDireccion ?? 'Calle, número, oficina o depto'}
        helperText={ayudaDireccion}
        required={direccionRequerida}
        disabled={disabled}
        maxLength={300}
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <Select label="Región" value={region} onChange={(e) => cambiarRegion(e.target.value)} disabled={disabled}>
          <option value="">Elige la región</option>
          {regionFueraDeCatalogo && <option value={region}>{region} (anterior)</option>}
          {REGIONES_CHILE.map((r) => (
            <option key={r.nombre} value={r.nombre}>
              {r.nombre}
            </option>
          ))}
        </Select>
        <Select label="Comuna" value={valor.comuna} onChange={(e) => onChange({ ...valor, region, comuna: e.target.value })} disabled={disabled || (!comunas.length && !comunaFueraDeCatalogo)}>
          <option value="">{comunas.length ? 'Elige la comuna' : 'Según la región'}</option>
          {comunaFueraDeCatalogo && <option value={valor.comuna}>{valor.comuna} (anterior)</option>}
          {comunas.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Input label="Ciudad" value={valor.ciudad} onChange={(e) => onChange({ ...valor, ciudad: e.target.value })} placeholder="Ej: Santiago" disabled={disabled} maxLength={100} />
      </div>
    </div>
  );
};
