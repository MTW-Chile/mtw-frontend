import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, Ruler, Layers, DollarSign, Boxes } from 'lucide-react';
import { getProyectoById } from '../../api/client';
import { formatNumber } from '../../lib/utils';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Cargando } from '../../components/ui/Estados';
import { Button } from '../../components/ui/Button';
import type { Ventana } from '../../types';
import { glosaEstadoPresupuesto } from '../../lib/estadosHetmo';
import { Tabla, Tbody, Td, Th, Thead, Tr } from '../../components/ui/Tabla';
import { Segmentado } from '../../components/ui/Segmentado';

// OC, Bodega y Control de Presupuesto viven en el modulo Proyectos (ver
// modules/proyectos/ProyectoWorkspace.tsx), no aca -- esta ficha es solo
// Cotizaciones: el despiece de ventanas y cotas de una version HETMO.
export const CotizacionDetalleModal: React.FC<{
  proyectoId: string | null;
  onClose: () => void;
}> = ({ proyectoId, onClose }) => {
  const [selectedVersionIdx, setSelectedVersionIdx] = useState(0);

  const { data: proyecto, isLoading } = useQuery({
    queryKey: ['proyectoDetail', proyectoId],
    queryFn: () => getProyectoById(proyectoId!),
    enabled: !!proyectoId,
  });

  if (!proyectoId) return null;

  const version = proyecto?.versiones[selectedVersionIdx] || proyecto?.versiones[0];
  const ventanas: Ventana[] = version?.ventanas || [];

  return (
    <Modal
      icono={Building2}
      ancho="xl"
      titulo={
        <span className="flex flex-wrap items-center gap-2">
          {proyecto?.obra || 'Cargando obra…'}
          <Badge size="sm" className="font-mono">
            {proyecto?.codigoInterno || `PRJ-${proyecto?.numeroPresupuesto}`}
          </Badge>
        </span>
      }
      subtitulo={
        <>
          Cliente: <span className="text-slate-800 font-semibold">{proyecto?.clienteNombreRaw}</span>
          {proyecto?.clienteRutRaw && <span className="ml-1.5 font-mono text-slate-400">({proyecto.clienteRutRaw})</span>}
        </>
      }
      onClose={onClose}
      pie={
        <Modal.Pie
          inicio={
            <span className="font-mono">
              ID HETMO: <strong className="text-slate-800">{version?.hetmoId}</strong>
            </span>
          }
        >
          <Button variant="outline" onClick={onClose}>
            Cerrar ficha
          </Button>
        </Modal.Pie>
      }
    >
      {isLoading ? (
        <Cargando texto="Cargando desglose de ventanas y cotas…" />
      ) : (
        <>
      {/* Version Selector & Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Version Picker */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-brand-600" />
            <span>Versión HETMO</span>
          </div>
          <Segmentado
            tamano="xs"
            etiqueta="Versión HETMO"
            valor={selectedVersionIdx}
            onChange={setSelectedVersionIdx}
            opciones={(proyecto?.versiones ?? []).map((v, idx) => ({ value: idx, label: `v${v.versionNumero}` }))}
          />
          <div className="text-[10px] text-slate-500">
            Estado:{' '}
            <span className="text-emerald-700 font-bold">
              {glosaEstadoPresupuesto(version?.estadoHetmo)}
            </span>
          </div>
        </div>

        {/* Superficie Total */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1.5">
            <Ruler className="w-3.5 h-3.5 text-sky-600" />
            <span>Superficie Total</span>
          </div>
          <div className="text-xl font-black font-mono text-slate-900">
            {formatNumber(version?.totalM2Ventanas, 2)}{' '}
            <span className="text-xs font-normal text-slate-500 font-sans">m²</span>
          </div>
          <div className="text-[10px] text-slate-400">Calculado sobre paños reales</div>
        </div>

        {/* Cantidad Ventanas */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1.5">
            <Boxes className="w-3.5 h-3.5 text-amber-600" />
            <span>Ventanas Físicas</span>
          </div>
          <div className="text-xl font-black font-mono text-slate-900">
            {ventanas.length}{' '}
            <span className="text-xs font-normal text-slate-500 font-sans">unidades</span>
          </div>
          <div className="text-[10px] text-slate-400">Total elementos presupuestados</div>
        </div>

        {/* Moneda / Monto */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
            <span>Moneda Base</span>
          </div>
          <div className="text-lg font-black text-slate-900 truncate">
            {version?.monedaDescripcion || 'UF'}
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            TC: {version?.tipoCambio || '1.0'}
          </div>
        </div>
      </div>

      {/* Matrix of Windows */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <span>Despiece de Ventanas y Paños</span>
            <Badge variant="brand" size="sm">
              {ventanas.length} ventanas
            </Badge>
          </h3>
        </div>

        <div className="border border-slate-200 rounded-xl bg-white shadow-xs overflow-hidden">
          <Tabla className="min-w-[760px]">
            <Thead>
              <Tr>
                <Th>Línea</Th>
                <Th>Modelo / Tipología</Th>
                <Th>Dimensiones (Ancho × Alto)</Th>
                <Th alinear="centro">Uds</Th>
                <Th alinear="derecha">Superficie (m²)</Th>
                <Th alinear="centro">Geometría</Th>
                <Th>Comentarios</Th>
              </Tr>
            </Thead>
            <Tbody>
              {ventanas.map((v, i) => (
                <Tr key={v.id || i} className="hover:bg-slate-50/80 transition-colors">
                  <Td className="font-mono font-bold text-slate-500">
                    #{v.orden || i + 1}
                  </Td>
                  <Td className="font-semibold text-slate-900">
                    <div>{v.modelo}</div>
                    {v.descripcionCorta && (
                      <span className="text-[10px] text-slate-400 block font-normal">
                        {v.descripcionCorta}
                      </span>
                    )}
                  </Td>
                  <Td className="font-mono text-brand-600 font-bold">
                    {formatNumber(v.anchoMm, 0)} × {formatNumber(v.altoMm, 0)}{' '}
                    <span className="text-[10px] text-slate-400 font-normal">mm</span>
                  </Td>
                  <Td alinear="centro" className="font-bold text-slate-900">
                    {v.unidades}
                  </Td>
                  <Td alinear="derecha" className="font-mono font-bold text-slate-900">
                    {formatNumber(v.m2Ventana, 2)} m²
                  </Td>
                  <Td alinear="centro">
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] text-slate-700 border border-slate-200">
                      {v.geometrias?.length || 0} cotas 2D
                    </span>
                  </Td>
                  <Td className="text-slate-500 max-w-xs truncate text-[11px]">
                    {v.comentarioPresupuesto || v.comentarioFabricacion || '-'}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Tabla>
        </div>
      </div>
        </>
      )}
    </Modal>
  );
};