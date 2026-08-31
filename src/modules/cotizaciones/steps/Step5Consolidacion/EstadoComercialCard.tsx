import React, { useState } from 'react';
import { ShieldCheck, Lock, Unlock, ArrowRight, ArrowLeft, GitFork, Loader2 } from 'lucide-react';
import type { ProyectoVersion } from '../../../../types';

type Estado = 'EN_COTIZACION' | 'ESPERANDO_APROBACION_COMERCIAL' | 'APROBADO_GERENCIA' | 'ACEPTADO_CLIENTE';

const ESTADOS_INFO: Record<Estado, { label: string; color: string }> = {
  EN_COTIZACION: { label: 'En Cotización', color: 'bg-slate-100 text-slate-700 border-slate-300' },
  ESPERANDO_APROBACION_COMERCIAL: { label: 'Esperando Aprobación Comercial', color: 'bg-amber-50 text-amber-700 border-amber-300' },
  APROBADO_GERENCIA: { label: 'Aprobado Gerencia', color: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
  ACEPTADO_CLIENTE: { label: 'Aceptado por Cliente', color: 'bg-blue-50 text-blue-700 border-blue-300' },
};

// BORRADOR es el valor historico de la columna antes de este flujo; se
// trata igual que EN_COTIZACION (ver normalizarEstado en el relay-api).
const normalizar = (estado: string): Estado =>
  estado === 'BORRADOR' ? 'EN_COTIZACION' : (estado as Estado);

interface EstadoComercialCardProps {
  activeVersion?: ProyectoVersion;
  onCambiarEstado: (estado: Estado) => void;
  isCambiandoEstado: boolean;
  onCrearVersionInterna: (hetmoId: number) => void;
  isCreandoVersion: boolean;
}

export const EstadoComercialCard: React.FC<EstadoComercialCardProps> = ({
  activeVersion,
  onCambiarEstado,
  isCambiandoEstado,
  onCrearVersionInterna,
  isCreandoVersion,
}) => {
  const [hetmoIdInput, setHetmoIdInput] = useState('');

  if (!activeVersion) return null;

  const estado = normalizar(activeVersion.estadoAprobacion);
  const info = ESTADOS_INFO[estado];

  const handleCrearVersion = () => {
    const hetmoId = Number(hetmoIdInput);
    if (!Number.isFinite(hetmoId) || hetmoId <= 0) return;
    onCrearVersionInterna(hetmoId);
    setHetmoIdInput('');
  };

  return (
    <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          {activeVersion.esCongelado ? (
            <Lock className="w-4 h-4 text-slate-500" />
          ) : (
            <Unlock className="w-4 h-4 text-slate-400" />
          )}
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Estado Comercial Interno
          </h3>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${info.color}`}>
          {info.label}
        </span>
      </div>

      {activeVersion.fechaAprobacion && (
        <p className="text-[11px] text-slate-500">
          Aprobado el {new Date(activeVersion.fechaAprobacion).toLocaleDateString('es-CL')}
          {activeVersion.aprobadoPor ? ` por ${activeVersion.aprobadoPor}` : ''}
        </p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {estado === 'EN_COTIZACION' && (
          <button
            onClick={() => onCambiarEstado('ESPERANDO_APROBACION_COMERCIAL')}
            disabled={isCambiandoEstado}
            className="px-3.5 py-2 rounded-xl bg-[#E34A26] text-white text-xs font-bold flex items-center gap-1.5 hover:bg-[#c93f1f] transition-colors disabled:opacity-50"
          >
            {isCambiandoEstado ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
            Enviar a Aprobación Comercial
          </button>
        )}

        {estado === 'ESPERANDO_APROBACION_COMERCIAL' && (
          <>
            <button
              onClick={() => onCambiarEstado('APROBADO_GERENCIA')}
              disabled={isCambiandoEstado}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {isCambiandoEstado ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              Aprobar (Gerencia)
            </button>
            <button
              onClick={() => onCambiarEstado('EN_COTIZACION')}
              disabled={isCambiandoEstado}
              className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-600 text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Volver a Cotización
            </button>
          </>
        )}

        {estado === 'APROBADO_GERENCIA' && (
          <>
            <button
              onClick={() => onCambiarEstado('ACEPTADO_CLIENTE')}
              disabled={isCambiandoEstado}
              className="px-3.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isCambiandoEstado ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
              Marcar Aceptado por Cliente
            </button>
            <button
              onClick={() => onCambiarEstado('ESPERANDO_APROBACION_COMERCIAL')}
              disabled={isCambiandoEstado}
              className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-600 text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Volver a Esperando Aprobación
            </button>
          </>
        )}

        {estado === 'ACEPTADO_CLIENTE' && (
          <p className="text-xs text-slate-500">
            Proyecto aceptado por el cliente. Queda visible pero bloqueado para edición
            (pasa al módulo de Taller y Fabricación cuando exista).
          </p>
        )}
      </div>

      {/* Crear Nueva Versión Interna: solo cuando ya esta aprobado por gerencia
          -- si todavia esta en cotizacion no tiene sentido reversionar, y una
          vez aceptado por el cliente ya no se toca. */}
      {estado === 'APROBADO_GERENCIA' && (
        <div className="pt-3.5 border-t border-slate-100 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <GitFork className="w-3.5 h-3.5 text-slate-500" />
            Crear Nueva Versión Interna
          </div>
          <p className="text-[11px] text-slate-500 max-w-lg">
            Guarda este presupuesto aprobado como está (queda accesible desde el Paso 1) y
            arranca una nueva versión interna importando otra versión del documento de venta HETMO.
            Útil si el cliente pide modificaciones después de emitido.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={hetmoIdInput}
              onChange={(e) => setHetmoIdInput(e.target.value)}
              placeholder="ID de versión HETMO"
              className="w-40 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-[#E34A26]"
            />
            <button
              onClick={handleCrearVersion}
              disabled={isCreandoVersion || !hetmoIdInput}
              className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              {isCreandoVersion && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Crear
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
