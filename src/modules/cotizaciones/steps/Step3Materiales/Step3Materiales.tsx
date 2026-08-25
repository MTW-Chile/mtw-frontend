import React, { useState, useMemo } from 'react';
import { 
  Boxes, 
  Search, 
  FileSpreadsheet, 
  FileDown, 
  CheckCircle2, 
  Check 
} from 'lucide-react';
import { formatNumber } from '../../../../lib/utils';
import type { Proyecto, ProyectoVersion, MaterialVentana } from '../../../../types';
import { DivisasForm } from '../Step1DatosCliente/DivisasForm';

interface Step3MaterialesProps {
  proyecto: Proyecto;
  activeVersion?: ProyectoVersion;
  // Divisas
  dolar: string;
  setDolar: (val: string) => void;
  uf: string;
  setUf: (val: string) => void;
  euro: string;
  setEuro: (val: string) => void;
  saveSuccess: boolean;
  onSaveDivisas: () => void;
  isSavingDivisas: boolean;
}

interface MaterialConsolidado {
  id: string;
  materialId: string;
  skuInterno: string;
  descripcion: string;
  familia: string;
  unidadMedida: string;
  proveedorNombre: string;
  cantidadTotal: number;
  precioOrigen: number;
  monedaOrigen: string;
  precioCLP: number;
  excluido: boolean;
}

export const Step3Materiales: React.FC<Step3MaterialesProps> = ({
  activeVersion,
  dolar,
  setDolar,
  uf,
  setUf,
  euro,
  setEuro,
  saveSuccess,
  onSaveDivisas,
  isSavingDivisas,
}) => {
  const [selectedFamily, setSelectedFamily] = useState<string>('TODAS');
  const [searchTerm, setSearchTerm] = useState('');
  const [materialExclusiones, setMaterialExclusiones] = useState<Record<string, boolean>>({});

  const tasaDolar = Number(dolar) || 950;
  const tasaUf = Number(uf) || 38500;
  const tasaEuro = Number(euro) || 1030;

  // Consolidar todos los materiales de las ventanas de esta versión
  const materialesConsolidados: MaterialConsolidado[] = useMemo(() => {
    const map = new Map<string, MaterialConsolidado>();
    const ventanas = activeVersion?.ventanas || [];

    ventanas.forEach((v) => {
      const mats: MaterialVentana[] = v.materiales || [];
      const unidadesVentana = v.unidades || 1;

      mats.forEach((mv) => {
        const mat = mv.material;
        const key = mv.materialId || mv.id;
        const cantidadTotal = (mv.cantidad || 1) * unidadesVentana;
        const precioOrigen = mv.precioOrigen || 0;
        const monedaOrigen = mv.monedaOrigen || 'CLP';

        let factorCLP = 1;
        if (monedaOrigen === 'USD') factorCLP = tasaDolar;
        else if (monedaOrigen === 'EUR') factorCLP = tasaEuro;
        else if (monedaOrigen === 'UF') factorCLP = tasaUf;

        const precioCLP = precioOrigen * factorCLP;

        if (map.has(key)) {
          const existing = map.get(key)!;
          existing.cantidadTotal += cantidadTotal;
        } else {
          map.set(key, {
            id: mv.id,
            materialId: mv.materialId,
            skuInterno: mat?.skuInterno || `SKU-${key.slice(0, 6)}`,
            descripcion: mat?.descripcion || 'Material de fábrica HETMO',
            familia: mat?.familia || 'ACCESORIOS',
            unidadMedida: mat?.unidadMedida || 'U',
            proveedorNombre: mat?.proveedor?.nombre || 'HETMO Almacén',
            cantidadTotal,
            precioOrigen,
            monedaOrigen,
            precioCLP,
            excluido: materialExclusiones[key] ?? mv.excluido ?? false,
          });
        }
      });
    });

    return Array.from(map.values());
  }, [activeVersion, tasaDolar, tasaEuro, tasaUf, materialExclusiones]);

  // Familias disponibles
  const familias = useMemo(() => {
    const set = new Set<string>();
    materialesConsolidados.forEach((m) => {
      if (m.familia) set.add(m.familia.toUpperCase().trim());
    });
    return Array.from(set).sort();
  }, [materialesConsolidados]);

  // Filtrar
  const filteredMateriales = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return materialesConsolidados.filter((m) => {
      const matchFamily = selectedFamily === 'TODAS' || m.familia.toUpperCase() === selectedFamily;
      if (!matchFamily) return false;
      if (!term) return true;
      const matchSku = m.skuInterno.toLowerCase().includes(term);
      const matchDesc = m.descripcion.toLowerCase().includes(term);
      const matchProv = m.proveedorNombre.toLowerCase().includes(term);
      return matchSku || matchDesc || matchProv;
    });
  }, [materialesConsolidados, selectedFamily, searchTerm]);

  // Totales
  const costoTotalCLP = filteredMateriales
    .filter((m) => !m.excluido)
    .reduce((acc, m) => acc + m.precioCLP * m.cantidadTotal, 0);

  const costoTotalUF = tasaUf > 0 ? costoTotalCLP / tasaUf : 0;
  const cantidadExcluidos = materialesConsolidados.filter((m) => m.excluido).length;

  const toggleExclusion = (materialKey: string) => {
    setMaterialExclusiones((prev) => ({
      ...prev,
      [materialKey]: !prev[materialKey],
    }));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. SECCIÓN: EDITOR DE DIVISAS DE LA OBRA */}
      <div className="space-y-2">
        <DivisasForm
          dolar={dolar}
          setDolar={setDolar}
          uf={uf}
          setUf={setUf}
          euro={euro}
          setEuro={setEuro}
        />
        <div className="flex items-center justify-between px-2">
          {saveSuccess ? (
            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5 animate-fade-in">
              <CheckCircle2 className="w-4 h-4" /> Tipos de cambio guardados en la versión
            </span>
          ) : (
            <span className="text-[11px] text-slate-500">
              Ajusta las tasas para recalcular el costo en pesos chilenos y cotizar en UF.
            </span>
          )}

          <button
            onClick={onSaveDivisas}
            disabled={isSavingDivisas}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{isSavingDivisas ? 'Guardando...' : 'Guardar Divisas'}</span>
          </button>
        </div>
      </div>

      {/* 2. SECCIÓN: ANALÍTICA Y DESGLOSE DE MATERIALES */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E34A26]/10 text-[#E34A26] border border-[#E34A26]/20 flex items-center justify-center shrink-0">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Analítica de Materiales y Costo Origen
              </h3>
              <p className="text-xs text-slate-500">
                {materialesConsolidados.length} materiales consolidados en fábrica
                {cantidadExcluidos > 0 && ` · ${cantidadExcluidos} excluidos`}
              </p>
            </div>
          </div>

          {/* Botones de Exportación */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => alert('Generando exportación de materiales en PDF...')}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
              title="Exportar materiales a PDF"
            >
              <FileDown className="w-4 h-4 text-[#E34A26]" />
              <span>Exportar PDF</span>
            </button>

            <button
              onClick={() => alert('Generando planilla de materiales en XLSX (Excel)...')}
              className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
              title="Exportar materiales a Excel XLSX"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Exportar XLSX</span>
            </button>
          </div>
        </div>

        {/* Resumen de Costos de Materiales */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">
              Insumos Visibles / Activos
            </span>
            <strong className="text-lg font-mono text-slate-900 font-bold">
              {filteredMateriales.filter((m) => !m.excluido).length} artículos
            </strong>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">
              Costo Materiales (CLP)
            </span>
            <strong className="text-lg font-mono text-slate-900 font-bold">
              $ {formatNumber(costoTotalCLP, 0)}
            </strong>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">
              Costo Materiales (UF)
            </span>
            <strong className="text-lg font-mono text-emerald-600 font-bold">
              {formatNumber(costoTotalUF, 2)} UF
            </strong>
          </div>
        </div>

        {/* Filtro por Familia y Buscador */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setSelectedFamily('TODAS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedFamily === 'TODAS'
                  ? 'bg-[#E34A26] text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Todas ({materialesConsolidados.length})
            </button>
            {familias.map((fam) => (
              <button
                key={fam}
                onClick={() => setSelectedFamily(fam)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  selectedFamily === fam
                    ? 'bg-[#E34A26] text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {fam}
              </button>
            ))}
          </div>

          <div className="relative min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar SKU o descripción..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-[#E34A26] focus:bg-white"
            />
          </div>
        </div>

        {/* Tabla de Materiales */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-96">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100 text-[11px] uppercase tracking-wider sticky top-0 text-slate-600">
              <tr>
                <th className="px-3.5 py-2.5 font-semibold">SKU</th>
                <th className="px-3.5 py-2.5 font-semibold">Descripción del Material</th>
                <th className="px-3.5 py-2.5 font-semibold">Familia</th>
                <th className="px-3.5 py-2.5 font-semibold">Proveedor</th>
                <th className="px-3.5 py-2.5 font-semibold text-right">Cantidad</th>
                <th className="px-3.5 py-2.5 font-semibold text-center">Unidad</th>
                <th className="px-3.5 py-2.5 font-semibold text-right">Precio Origen</th>
                <th className="px-3.5 py-2.5 font-semibold text-right">Total CLP</th>
                <th className="px-3.5 py-2.5 font-semibold text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredMateriales.map((m) => (
                <tr
                  key={m.id}
                  className={`hover:bg-slate-50 transition-colors ${
                    m.excluido ? 'opacity-40 bg-slate-50' : ''
                  }`}
                >
                  <td className="px-3.5 py-2 font-mono font-bold text-slate-900">{m.skuInterno}</td>
                  <td className="px-3.5 py-2 font-medium text-slate-800">{m.descripcion}</td>
                  <td className="px-3.5 py-2">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[10px]">
                      {m.familia}
                    </span>
                  </td>
                  <td className="px-3.5 py-2 text-slate-500">{m.proveedorNombre}</td>
                  <td className="px-3.5 py-2 text-right font-mono font-bold text-slate-900">
                    {formatNumber(m.cantidadTotal, 2)}
                  </td>
                  <td className="px-3.5 py-2 text-center text-slate-500 font-mono">{m.unidadMedida}</td>
                  <td className="px-3.5 py-2 text-right font-mono text-slate-700">
                    {m.monedaOrigen} {formatNumber(m.precioOrigen, 2)}
                  </td>
                  <td className="px-3.5 py-2 text-right font-mono font-bold text-slate-900">
                    $ {formatNumber(m.precioCLP * m.cantidadTotal, 0)}
                  </td>
                  <td className="px-3.5 py-2 text-center">
                    <button
                      onClick={() => toggleExclusion(m.materialId || m.id)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                        m.excluido
                          ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200'
                      }`}
                      title={m.excluido ? 'Click para incluir' : 'Click para excluir'}
                    >
                      {m.excluido ? 'Excluido' : 'Incluido'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
