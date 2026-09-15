import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, FolderKanban, ChevronRight } from 'lucide-react';
import { getProyectos } from '../../api/client';
import { ProyectoWorkspace } from './ProyectoWorkspace';

// El ERP funciona "desde el proyecto": esta pantalla lista los proyectos
// ya ganados (version mas reciente en ACEPTADO_CLIENTE -- ahi recien
// arranca la ejecucion real: comprar, guardar en bodega, controlar el
// gasto contra el presupuesto). Cotizaciones sigue siendo el modulo
// aparte para lo que todavia se esta negociando.
export const ProyectosPage: React.FC = () => {
  const [proyectoId, setProyectoId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['proyectos', 'en-curso'],
    queryFn: () => getProyectos({ limit: 200 }),
  });

  const proyectosEnCurso = (data?.data || []).filter((p) => p.versiones[0]?.estadoAprobacion === 'ACEPTADO_CLIENTE');

  if (proyectoId) {
    return <ProyectoWorkspace proyectoId={proyectoId} onVolver={() => setProyectoId(null)} />;
  }

  return (
    <div className="p-5 sm:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#E34A26]/10 flex items-center justify-center text-[#E34A26]">
          <FolderKanban className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-black text-slate-900">Proyectos en curso</h1>
          <p className="text-xs text-slate-500">Obras ya aceptadas por el cliente -- entrá a una para presupuesto, OC, documentos y bodega</p>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 flex items-center justify-center text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : proyectosEnCurso.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 text-slate-400 text-xs">
          Todavía no hay proyectos aceptados por el cliente. Un proyecto pasa a "en curso" cuando su versión llega a estado ACEPTADO_CLIENTE en Cotizaciones.
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm divide-y divide-slate-50">
          {proyectosEnCurso.map((p) => (
            <button
              key={p.id}
              onClick={() => setProyectoId(p.id)}
              className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50/70 transition-colors cursor-pointer"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 truncate">{p.obra}</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-mono font-bold shrink-0">
                    {p.codigoInterno || `PRJ-${p.numeroPresupuesto}`}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate">{p.clienteNombreRaw}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
