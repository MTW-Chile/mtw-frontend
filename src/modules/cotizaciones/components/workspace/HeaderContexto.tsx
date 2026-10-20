import React from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import { Badge } from '../../../../components/ui/Badge';
import { HeaderSlot } from '../../../../components/layout/HeaderSlot';
import type { Proyecto, ProyectoVersion } from '../../../../types';

// Versión corta para anchos medios (el header no tiene lugar para la larga).
const ESTADO_CORTO: Record<string, string> = {
  BORRADOR: 'En Cotización',
  EN_COTIZACION: 'En Cotización',
  ESPERANDO_APROBACION_COMERCIAL: 'Esp. Aprob. Gerencial',
  APROBADO_GERENCIA: 'Aprob. Gerencia',
  ACEPTADO_CLIENTE: 'Aceptado',
};

// BORRADOR es el valor historico de la columna antes del flujo de estado
// comercial; se muestra igual que EN_COTIZACION (ver EstadoComercialCard).
const ESTADO_LABEL: Record<string, string> = {
  BORRADOR: 'En Cotización',
  EN_COTIZACION: 'En Cotización',
  ESPERANDO_APROBACION_COMERCIAL: 'Esperando Aprobación Gerencial',
  APROBADO_GERENCIA: 'Aprobado Gerencia',
  ACEPTADO_CLIENTE: 'Aceptado por Cliente',
};

interface HeaderContextoProps {
  proyecto: Proyecto;
  activeVersion?: ProyectoVersion;
}

/**
 * Contexto de la obra en el Header del sitio (portal al slot): estado de
 * aprobación (el código va en las migas, junto al nombre). El selector de paso vive en el footer
 * (SelectorPaso), no acá.
 */
export const HeaderContexto: React.FC<HeaderContextoProps> = ({ activeVersion }) => {
  const estadoTexto = activeVersion
    ? ESTADO_LABEL[activeVersion.estadoAprobacion] || activeVersion.estadoAprobacion
    : 'En Cotización';
  const estadoCorto = activeVersion ? ESTADO_CORTO[activeVersion.estadoAprobacion] || estadoTexto : 'En Cotización';
  const congeladoGerencial =
    activeVersion?.estadoAprobacion === 'APROBADO_GERENCIA' || activeVersion?.estadoAprobacion === 'ACEPTADO_CLIENTE';

  return (
    <HeaderSlot>
      {/* Solo cuando hay ancho de sobra: en tablet y móvil el header ya está lleno
          (hamburguesa, logo, atrás/recargar, campana, usuario). */}
      <div className="hidden @4xl:flex items-center gap-2 shrink-0">
        <Badge size="sm" variant={activeVersion?.esCongelado ? 'success' : 'brand'} title={estadoTexto}>
          <span className="inline-flex items-center gap-1">
            {activeVersion?.esCongelado &&
              (congeladoGerencial ? <ShieldCheck className="w-3 h-3" /> : <Lock className="w-3 h-3" />)}
            <span className="@5xl:hidden">{estadoCorto}</span>
            <span className="hidden @5xl:inline">{estadoTexto}</span>
          </span>
        </Badge>
      </div>
    </HeaderSlot>
  );
};
