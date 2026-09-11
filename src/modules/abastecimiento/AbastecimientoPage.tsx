import React from 'react';
import { ShoppingCart } from 'lucide-react';
import { OrdenesCompraList } from './OrdenesCompraList';

// Vista global de Abastecimiento (todas las obras) -- para Compras
// haciendo seguimiento de todo el portafolio. El flujo principal del ERP
// es "desde el proyecto" (ver la pestaña OC en la ficha de cada proyecto,
// CotizacionDetalleModal): esta pantalla es el complemento cross-proyecto,
// no el punto de entrada.
export const AbastecimientoPage: React.FC = () => {
  return (
    <div className="p-5 sm:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#E34A26]/10 flex items-center justify-center text-[#E34A26]">
          <ShoppingCart className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-black text-slate-900">Órdenes de Compra</h1>
          <p className="text-xs text-slate-500">Todas las obras -- para crear una OC desde un proyecto específico, entrá a su ficha</p>
        </div>
      </div>

      <OrdenesCompraList />
    </div>
  );
};
