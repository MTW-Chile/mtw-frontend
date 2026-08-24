import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, Building2, DollarSign, Layers, Boxes, Ruler, RotateCcw, 
  CheckCircle2, ArrowRight, User, Coins, ShieldCheck, AlertTriangle, 
  FileSpreadsheet, Calculator, Info, FileText
} from 'lucide-react';
import { getProyectoById, updateVersionConfig, triggerManualSync } from '../../api/client';
import { formatNumber } from '../../lib/utils';
import type { Ventana, ProyectoVersion } from '../../types';

interface CotizadorWorkspaceProps {
  proyectoId: string;
  onBack: () => void;
}

export const CotizadorWorkspace: React.FC<CotizadorWorkspaceProps> = ({ proyectoId, onBack }) => {
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [selectedVersionIdx, setSelectedVersionIdx] = useState(0);
  const [showReimportModal, setShowReimportModal] = useState(false);

  // Form State para Paso 1 (Divisas)
  const [dolar, setDolar] = useState<string>('950');
  const [uf, setUf] = useState<string>('38500');
  const [euro, setEuro] = useState<string>('1030');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form State para Cliente (Paso 1)
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteRut, setClienteRut] = useState('');
  const [clienteDireccion, setClienteDireccion] = useState('');
  const [clienteLocalidad, setClienteLocalidad] = useState('');
  const [clienteContacto, setClienteContacto] = useState('');
  const [clienteTelefono, setClienteTelefono] = useState('');
  const [clienteEmail, setClienteEmail] = useState('');

  const { data: proyecto, isLoading, isError } = useQuery({
    queryKey: ['proyectoDetail', proyectoId],
    queryFn: () => getProyectoById(proyectoId),
    enabled: !!proyectoId,
  });

  const activeVersion: ProyectoVersion | undefined = 
    proyecto?.versiones[selectedVersionIdx] || proyecto?.versiones[0];

  useEffect(() => {
    if (activeVersion) {
      setDolar(activeVersion.tipoCambioDolar ? String(activeVersion.tipoCambioDolar) : '950');
      setUf(activeVersion.tipoCambioUF ? String(activeVersion.tipoCambioUF) : '38500');
      setEuro(activeVersion.tipoCambioEuro ? String(activeVersion.tipoCambioEuro) : '1030');
    }
    if (proyecto) {
      if (proyecto.cliente) {
        setClienteNombre(proyecto.cliente.nombre || '');
        setClienteRut(proyecto.cliente.rut || '');
        setClienteDireccion(proyecto.cliente.direccion || '');
        setClienteLocalidad(proyecto.cliente.localidad || '');
        setClienteContacto(proyecto.cliente.contacto || '');
        setClienteTelefono(proyecto.cliente.telefono || '');
        setClienteEmail(proyecto.cliente.email || '');
      } else {
        setClienteNombre(proyecto.clienteNombreRaw || '');
        setClienteRut(proyecto.clienteRutRaw || '');
        setClienteDireccion(proyecto.clienteDireccionRaw || '');
        setClienteLocalidad(proyecto.clienteLocalidadRaw || '');
      }
    }
  }, [activeVersion, proyecto]);

  const updateConfigMutation = useMutation({
    mutationFn: async () => {
      if (!activeVersion) return;
      return updateVersionConfig(activeVersion.id, {
        tipoCambioDolar: dolar ? Number(dolar) : null,
        tipoCambioUF: uf ? Number(uf) : null,
        tipoCambioEuro: euro ? Number(euro) : null,
        estadoAprobacion: activeVersion.estadoAprobacion === 'BORRADOR' ? 'EN_COTIZACION' : activeVersion.estadoAprobacion,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyectoId] });
      queryClient.invalidateQueries({ queryKey: ['proyectos'] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    },
  });

  const reimportMutation = useMutation({
    mutationFn: async () => triggerManualSync(true),
    onSuccess: () => {
      setShowReimportModal(false);
      queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyectoId] });
      queryClient.invalidateQueries({ queryKey: ['proyectos'] });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-[#080C14] text-slate-300">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-xs font-mono text-slate-400">Cargando cotizador de la obra...</div>
        </div>
      </div>
    );
  }

  if (isError || !proyecto) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-[#080C14] text-slate-300">
        <div className="text-center space-y-4">
          <div className="text-red-400 font-bold text-sm">Error al cargar la obra.</div>
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-white hover:bg-slate-700"
          >
            Volver al listado
          </button>
        </div>
      </div>
    );
  }

  const ventanas: Ventana[] = activeVersion?.ventanas || [];

  return (
    <div className="min-h-screen bg-[#080C14] text-slate-100 flex flex-col animate-fade-in">
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-white/[0.08] px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-white/10 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a Obras</span>
          </button>

          <div className="h-6 w-px bg-white/10 hidden sm:block" />

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-slate-100">{proyecto.obra}</h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-white/10 text-slate-300 font-mono">
                  {proyecto.codigoInterno || `PRJ-${proyecto.numeroPresupuesto}`}
                </span>
                {activeVersion?.esCongelado ? (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Aprobado Gerencia
                  </span>
                ) : (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-semibold">
                    {activeVersion?.estadoAprobacion || 'En Cotización'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {proyecto.versiones.length > 1 && (
            <div className="flex items-center bg-slate-900 rounded-xl p-1 border border-white/10">
              {proyecto.versiones.map((v, idx) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVersionIdx(idx)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                    selectedVersionIdx === idx
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Rev {v.versionNumero}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => setShowReimportModal(true)}
            disabled={activeVersion?.esCongelado}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 border border-white/10 hover:border-amber-500/30 text-xs font-medium transition-all flex items-center gap-1.5 disabled:opacity-40"
            title="Restablecer presupuesto leyendo los datos originales de HETMO"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Reimportar HETMO</span>
          </button>
        </div>
      </header>

      {/* Stepper de 5 pasos */}
      <div className="bg-slate-950/60 border-b border-white/[0.06] px-4 sm:px-8 py-3 overflow-x-auto">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 min-w-max">
          <button
            onClick={() => setCurrentStep(1)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              currentStep === 1
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              currentStep === 1 ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-400'
            }`}>
              1
            </span>
            <span>Datos & Cliente</span>
          </button>

          <span className="text-slate-700 font-bold">➔</span>

          <button
            onClick={() => setCurrentStep(2)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              currentStep === 2
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              currentStep === 2 ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-400'
            }`}>
              2
            </span>
            <span>Revisión de Líneas</span>
          </button>

          <span className="text-slate-700 font-bold">➔</span>

          <button
            onClick={() => setCurrentStep(3)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              currentStep === 3
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              currentStep === 3 ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-400'
            }`}>
              3
            </span>
            <span>Analítica de Materiales</span>
          </button>

          <span className="text-slate-700 font-bold">➔</span>

          <button
            onClick={() => setCurrentStep(4)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              currentStep === 4
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              currentStep === 4 ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-400'
            }`}>
              4
            </span>
            <span>Hoja de Fijación</span>
          </button>

          <span className="text-slate-700 font-bold">➔</span>

          <button
            onClick={() => setCurrentStep(5)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              currentStep === 5
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              currentStep === 5 ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-400'
            }`}>
              5
            </span>
            <span>Consolidación & PDF</span>
          </button>
        </div>
      </div>

      <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-6xl w-full mx-auto space-y-6">
        {currentStep === 1 && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Total Ventanas</div>
                  <div className="text-lg font-bold text-slate-100 font-mono">
                    {activeVersion?.totalVentanas || 0}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                  <Ruler className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Superficie Total</div>
                  <div className="text-lg font-bold text-slate-100 font-mono">
                    {formatNumber(activeVersion?.totalM2Ventanas, 2)} <span className="text-xs text-slate-400 font-normal">m²</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Materiales Base</div>
                  <div className="text-lg font-bold text-slate-100 font-mono">
                    {activeVersion?.totalMateriales || 0}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Importe Base HETMO</div>
                  <div className="text-lg font-bold text-emerald-400 font-mono">
                    {activeVersion?.monedaSimbolo || '$'} {formatNumber(activeVersion?.importeTotal, 0)}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/50 border border-white/[0.08] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-slate-100 font-bold text-sm">
                  <User className="w-4 h-4 text-cyan-400" />
                  <span>1. Identificación y Registro del Cliente</span>
                </div>
                <span className="text-xs text-cyan-400 font-medium flex items-center gap-1">
                  <Info className="w-3.5 h-3.5" /> Maestro de clientes
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-300 font-medium">Razón Social / Nombre Comercial</label>
                  <input
                    type="text"
                    value={clienteNombre}
                    onChange={(e) => setClienteNombre(e.target.value)}
                    placeholder="Ej: Constructora Inmobiliaria SpA"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950/70 border border-white/10 text-slate-100 text-xs font-semibold focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-300 font-medium">RUT / Identificador Fiscal</label>
                  <input
                    type="text"
                    value={clienteRut}
                    onChange={(e) => setClienteRut(e.target.value)}
                    placeholder="Ej: 76.123.456-7"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950/70 border border-white/10 text-slate-100 text-xs font-mono font-semibold focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-300 font-medium">Contacto Principal (Nombre)</label>
                  <input
                    type="text"
                    value={clienteContacto}
                    onChange={(e) => setClienteContacto(e.target.value)}
                    placeholder="Ej: Juan Pérez (Jefe de Obra)"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950/70 border border-white/10 text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-300 font-medium">Dirección de Obra / Destino</label>
                  <input
                    type="text"
                    value={clienteDireccion}
                    onChange={(e) => setClienteDireccion(e.target.value)}
                    placeholder="Ej: Av. Las Condes 1234"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950/70 border border-white/10 text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-300 font-medium">Comuna / Ciudad</label>
                  <input
                    type="text"
                    value={clienteLocalidad}
                    onChange={(e) => setClienteLocalidad(e.target.value)}
                    placeholder="Ej: Santiago, Región Metropolitana"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950/70 border border-white/10 text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-300 font-medium">Teléfono / Correo de Contacto</label>
                  <input
                    type="text"
                    value={clienteEmail || clienteTelefono}
                    onChange={(e) => setClienteEmail(e.target.value)}
                    placeholder="contacto@constructora.cl"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950/70 border border-white/10 text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/50 border border-white/[0.08] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-100 font-bold text-sm">
                  <Coins className="w-4 h-4 text-cyan-400" />
                  <span>2. Parámetros Económicos y Divisas de la Obra</span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">
                  Valores específicos para este presupuesto
                </span>
              </div>

              <p className="text-xs text-slate-400">
                Define los tipos de cambio para convertir las compras internacionales (USD/EUR) al costo real en pesos chilenos y cotizar en UF.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-950/70 border border-white/10 space-y-2">
                  <label className="text-xs text-slate-300 font-semibold flex items-center justify-between">
                    <span>Dólar Observado (USD)</span>
                    <span className="text-[10px] text-cyan-400 font-mono">$ CLP</span>
                  </label>
                  <input
                    type="number"
                    value={dolar}
                    onChange={(e) => setDolar(e.target.value)}
                    placeholder="950.00"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-slate-100 font-mono font-bold text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>

                <div className="p-4 rounded-xl bg-slate-950/70 border border-white/10 space-y-2">
                  <label className="text-xs text-slate-300 font-semibold flex items-center justify-between">
                    <span>Unidad de Fomento (UF)</span>
                    <span className="text-[10px] text-cyan-400 font-mono">$ CLP</span>
                  </label>
                  <input
                    type="number"
                    value={uf}
                    onChange={(e) => setUf(e.target.value)}
                    placeholder="38500.00"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-slate-100 font-mono font-bold text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>

                <div className="p-4 rounded-xl bg-slate-950/70 border border-white/10 space-y-2">
                  <label className="text-xs text-slate-300 font-semibold flex items-center justify-between">
                    <span>Euro Oficial (EUR)</span>
                    <span className="text-[10px] text-cyan-400 font-mono">$ CLP</span>
                  </label>
                  <input
                    type="number"
                    value={euro}
                    onChange={(e) => setEuro(e.target.value)}
                    placeholder="1030.00"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-slate-100 font-mono font-bold text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/50 border border-white/[0.08] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-100 font-bold text-sm">
                  <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
                  <span>3. Tipologías Importadas de Fábrica ({ventanas.length} modelos)</span>
                </div>
                <span className="text-xs text-slate-400">
                  Total: <strong className="text-slate-200 font-mono">{activeVersion?.totalVentanas} ventanas</strong>
                </span>
              </div>

              <div className="overflow-x-auto max-h-60 rounded-xl border border-white/10">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-[11px] uppercase tracking-wider text-slate-400 sticky top-0">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Línea</th>
                      <th className="px-4 py-2.5 font-semibold">Modelo</th>
                      <th className="px-4 py-2.5 font-semibold text-center">Uds</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Dimensiones (mm)</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Superficie (m²)</th>
                      <th className="px-4 py-2.5 font-semibold">Acabado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {ventanas.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-800/30">
                        <td className="px-4 py-2.5 font-mono text-slate-400">#{v.lineaHetmo}</td>
                        <td className="px-4 py-2.5 font-semibold text-slate-200">{v.modelo}</td>
                        <td className="px-4 py-2.5 text-center font-bold text-cyan-400">{v.unidades}</td>
                        <td className="px-4 py-2.5 text-right font-mono">{formatNumber(v.anchoMm, 0)} × {formatNumber(v.altoMm, 0)}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-100">{formatNumber(v.m2Ventana, 2)}</td>
                        <td className="px-4 py-2.5 text-slate-400">{v.acabadoCodigo || 'Estándar'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="p-12 text-center space-y-3 animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-100">Paso 2: Revisión de Líneas y Tipologías</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Inspección técnica de cada ventana con sus medidas, aperturas, comentarios de taller y precios unitarios.
            </p>
          </div>
        )}

        {currentStep === 3 && (
          <div className="p-12 text-center space-y-3 animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto">
              <Boxes className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-100">Paso 3: Analítica de Materiales</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Ajuste macro de precios en moneda origen, reclasificación de familias, exclusión de vidrios fantasma y sustitución de productos.
            </p>
          </div>
        )}

        {currentStep === 4 && (
          <div className="p-12 text-center space-y-3 animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto">
              <Calculator className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-100">Paso 4: Hoja de Fijación y Extras</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Cálculo de fijaciones, tornillería, sellantes, grúas, traslados y mano de obra de instalación.
            </p>
          </div>
        )}

        {currentStep === 5 && (
          <div className="p-12 text-center space-y-3 animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-100">Paso 5: Consolidación, Aprobación & PDF</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Resumen comercial, control de Aprobación de Gerencia y generación del Presupuesto final en PDF.
            </p>
          </div>
        )}
      </main>

      <footer className="sticky bottom-0 z-30 bg-slate-950/95 backdrop-blur-md border-t border-white/[0.08] px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5 animate-fade-in">
              <CheckCircle2 className="w-4 h-4" /> Parámetros guardados con éxito en la base de datos
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {currentStep > 1 && (
            <button
              onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors border border-white/10"
            >
              ← Paso Anterior
            </button>
          )}

          {currentStep === 1 && (
            <button
              onClick={() => {
                updateConfigMutation.mutate();
                setCurrentStep(2);
              }}
              disabled={updateConfigMutation.isPending}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2"
            >
              <span>Guardar y Pasar a Revisión de Líneas</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {currentStep > 1 && currentStep < 5 && (
            <button
              onClick={() => setCurrentStep((prev) => (prev + 1) as any)}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2"
            >
              <span>Continuar al Paso {currentStep + 1}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </footer>

      {showReimportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-[#0F1523] border border-amber-500/30 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-slate-100">¿Reimportar desde HETMO?</h3>
              <p className="text-xs text-slate-400">
                Esta acción volverá a leer los datos crudos desde SQL Server. Si realizaste modificaciones personalizadas de precios o sustituciones en esta versión, se restablecerán a los valores originales de fábrica.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowReimportModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => reimportMutation.mutate()}
                disabled={reimportMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${reimportMutation.isPending ? 'animate-spin' : ''}`} />
                <span>{reimportMutation.isPending ? 'Reimportando...' : 'Sí, Reimportar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
