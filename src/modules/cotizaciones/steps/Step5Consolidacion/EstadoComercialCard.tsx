import React, { useState } from 'react';
import { Lock, Unlock, ArrowRight, ArrowLeft, GitFork } from 'lucide-react';
import type { ProyectoVersion } from '../../../../types';
import { Button } from '../../../../components/ui/Button';
import { InputCompacto } from '../../../../components/ui/Campos';
import { useConfirmar } from '../../../../components/ui/Confirmar';

type Estado = 'EN_COTIZACION' | 'ESPERANDO_APROBACION_COMERCIAL' | 'APROBADO_GERENCIA' | 'ACEPTADO_CLIENTE';

const ESTADOS_INFO: Record<Estado, { label: string; color: string }> = {
  EN_COTIZACION: { label: 'En Cotización', color: 'bg-slate-100 text-slate-700 border-slate-300' },
  ESPERANDO_APROBACION_COMERCIAL: { label: 'Esperando Aprobación Gerencial', color: 'bg-amber-50 text-amber-700 border-amber-300' },
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
  const { confirmar } = useConfirmar();
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
          <p className="text-xs text-slate-500">
            Aprueba la Analítica de Materiales por completo en el Paso 3 y luego solicita la aprobación gerencial desde la Hoja de Fijación (Paso 4).
          </p>
        )}

        {estado === 'ESPERANDO_APROBACION_COMERCIAL' && (
          <p className="text-xs text-slate-500">
            Pendiente de aprobación gerencial. Se aprueba desde la Hoja de Fijación (Paso 4).
          </p>
        )}

        {estado === 'APROBADO_GERENCIA' && (
          <>
            <Button size="sm" onClick={() => onCambiarEstado('ACEPTADO_CLIENTE')} isLoading={isCambiandoEstado} leftIcon={<ArrowRight className="w-3.5 h-3.5" />}>
              Marcar aceptado por cliente
            </Button>
            <Button variant="outline" size="sm" onClick={() => onCambiarEstado('ESPERANDO_APROBACION_COMERCIAL')} disabled={isCambiandoEstado} leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
              Volver a esperando aprobación
            </Button>
          </>
        )}

        {estado === 'ACEPTADO_CLIENTE' && (
          <>
            <p className="text-xs text-slate-500">
              Proyecto aceptado por el cliente. Queda bloqueado para edición y pasa al
              módulo de Obras para su ejecución (presupuesto, OC, documentos y bodega).
            </p>
            <Button
              variant="outline"
              size="sm"
              isLoading={isCambiandoEstado}
              leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
              onClick={async () => {
                const ok = await confirmar({
                  titulo: '¿Revertir la aceptación del cliente?',
                  mensaje:
                    'El proyecto vuelve a "Aprobado Gerencia", a la espera de ser aceptado de nuevo. Sale de "Obras en curso", pero lo ya obrado (bodega, órdenes de compra, etc.) no se elimina automáticamente.',
                  confirmar: 'Revertir',
                  peligro: true,
                });
                if (ok) onCambiarEstado('APROBADO_GERENCIA');
              }}
            >
              Revertir aceptación de cliente
            </Button>
          </>
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
            <InputCompacto
              aria-label="ID de versión HETMO"
              type="number"
              min={1}
              value={hetmoIdInput}
              onChange={(e) => setHetmoIdInput(e.target.value)}
              placeholder="ID de versión HETMO"
              className="w-40"
            />
            <Button variant="secondary" size="sm" onClick={handleCrearVersion} disabled={!hetmoIdInput} isLoading={isCreandoVersion}>
              Crear
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
