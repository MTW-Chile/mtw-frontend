import { History } from 'lucide-react';
import type { Proyecto } from '../../types';
import { AYUDA_OBRA_LEGACY, ETIQUETA_OBRA_LEGACY, codigoDeObra, esObraLegacy } from '../../lib/obraLegacy';
import { Badge } from './Badge';

/**
 * Indicador de obra anterior al ERP (ver lib/obraLegacy). Va junto al nombre o al
 * código de la obra en TODA lista de obras del sitio; no se escribe a mano.
 */
export function EtiquetaObraLegacy({ obra, className = '' }: { obra: { origen?: Proyecto['origen'] } | null | undefined; className?: string }) {
  if (!esObraLegacy(obra)) return null;
  return (
    <Badge size="sm" variant="violet" title={AYUDA_OBRA_LEGACY} className={`shrink-0 whitespace-nowrap ${className}`}>
      <History className="w-3 h-3" aria-hidden />
      {ETIQUETA_OBRA_LEGACY}
    </Badge>
  );
}

/**
 * Código de la obra (PRJ-2026-813) como píldora, seguido del indicador de obra
 * anterior al ERP cuando corresponde. Es la forma única de mostrar el código de una
 * obra en una lista: así el indicador aparece en todas sin repetirlo.
 */
export function CodigoObra({ obra, className = '' }: { obra: { codigoInterno?: string | null; numeroPresupuesto?: number | null; origen?: Proyecto['origen'] }; className?: string }) {
  return (
    // Código e indicador van juntos: si no caben al lado del nombre, bajan los dos.
    <span className={`inline-flex items-center gap-1.5 shrink-0 ${className}`}>
      <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-mono font-bold whitespace-nowrap">{codigoDeObra(obra)}</span>
      <EtiquetaObraLegacy obra={obra} />
    </span>
  );
}
