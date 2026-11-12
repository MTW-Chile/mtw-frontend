import React from 'react';
import { PackageCheck, ShoppingCart } from 'lucide-react';
import { Segmentado } from '../../../components/ui/Segmentado';
import { useUrlParam } from '../../../lib/navigation';
import { OrdenesCompraList } from '../OrdenesCompraList';
import { ReservaMaterialesSection } from './ReservaMaterialesSection';

export type VistaAbastecimiento = 'reserva' | 'compras';

/**
 * Obras en curso > Abastecimiento: la reserva de materiales de toda la obra
 * (precios cotizados comprometidos) y las compras que se van haciendo. La
 * vista vive en la URL (?vista=compras) para que Atrás y los enlaces la respeten.
 * Si su tipo de proyecto no usa reserva (sinReserva; retail, que se fabrica de
 * una tirada), solo compras.
 */
export const AbastecimientoObraTab: React.FC<{ proyectoId: string; proyectoLabel: string; sinReserva?: boolean }> = ({ proyectoId, proyectoLabel, sinReserva = false }) => {
  const [vistaUrl, setVista] = useUrlParam('vista');
  if (sinReserva) return <OrdenesCompraList proyectoId={proyectoId} proyectoLabel={proyectoLabel} />;
  const vista: VistaAbastecimiento = vistaUrl === 'compras' ? 'compras' : 'reserva';
  return (
    <div className="space-y-4">
      <Segmentado
        etiqueta="Vista de abastecimiento"
        opciones={[
          { value: 'reserva', label: 'Reserva de materiales', icono: PackageCheck },
          { value: 'compras', label: 'Compras', icono: ShoppingCart },
        ]}
        valor={vista}
        onChange={(v) => setVista(v === 'reserva' ? null : v, { replace: true })}
      />
      {vista === 'reserva' ? <ReservaMaterialesSection proyectoId={proyectoId} /> : <OrdenesCompraList proyectoId={proyectoId} proyectoLabel={proyectoLabel} />}
    </div>
  );
};
