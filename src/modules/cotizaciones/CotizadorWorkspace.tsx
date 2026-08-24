import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  Building2, 
  DollarSign, 
  Layers, 
  Boxes, 
  Ruler, 
  RotateCcw, 
  CheckCircle2, 
  ArrowRight,
  User,
  Coins,
  ShieldCheck,
  AlertTriangle,
  FileSpreadsheet,
  Calculator,
  Info,
  FileText,
  Search,
  Plus
} from 'lucide-react';
import { getProyectoById, updateVersionConfig, triggerManualSync, updateProyectoCliente } from '../../api/client';
import { formatNumber } from '../../lib/utils';
import type { Ventana, ProyectoVersion } from '../../types';

interface CotizadorWorkspaceProps {
  proyectoId: string;
  onBack: () => void;
  isDarkMode?: boolean;
}

export const CotizadorWorkspace: React.FC<CotizadorWorkspaceProps> = ({ proyectoId, onBack, isDarkMode = false }) => {
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
  const [clienteGiro, setClienteGiro] = useState('');
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
        setClienteGiro(proyecto.cliente.giro || '');
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
      <div className={`min-h-screen flex items-center justify-center p-8 ${isDarkMode ? 'bg-[#080C14] text-slate-300' : 'bg-slate-50 text-slate-700'}`}>
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#E34A26] border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-xs font-mono">Cargando cotizador de la obra...</div>
        </div>
      </div>
    );
  }

  if (isError || !proyecto) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-8 ${isDarkMode ? 'bg-[#080C14] text-slate-300' : 'bg-slate-50 text-slate-700'}`}>
        <div className="text-center space-y-4">
          <div className="text-red-500 font-bold text-sm">Error al cargar la obra.</div>
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
    <div className={`min-h-screen flex flex-col animate-fade-in transition-colors duration-200 ${
      isDarkMode ? 'bg-[#080C14] text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      
      {/* HEADER SUPERIOR */}
      <header className={`sticky top-0 z-30 backdrop-blur-md border-b px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4 transition-colors ${
        isDarkMode ? 'bg-slate-950/90 border-white/[0.08]' : 'bg-white/90 border-slate-200 shadow-sm'
      }`}>
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm ${
              isDarkMode 
                ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-white/10' 
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-sm'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a Obras</span>
          </button>

          <div className={`h-6 w-px hidden sm:block ${isDarkMode ? 'bg-white/10' : 'bg-slate-200'}`} />

          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
              isDarkMode ? 'bg-[#E34A26]/10 text-[#FF6B4A] border border-[#E34A26]/20' : 'bg-[#E34A26]/10 text-[#E34A26] border border-[#E34A26]/30'
            }`}>
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold tracking-tight">{proyecto.obra}</h1>
                <span className={`text-xs px-2 py-0.5 rounded-full font-mono border ${
                  isDarkMode ? 'bg-slate-800 border-white/10 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-700'
                }`}>
                  {proyecto.codigoInterno || `PRJ-${proyecto.numeroPresupuesto}`}
                </span>
                {activeVersion?.esCongelado ? (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Aprobado Gerencia
                  </span>
                ) : (
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold border ${
                    isDarkMode ? 'bg-[#E34A26]/10 border-[#E34A26]/30 text-[#FF6B4A]' : 'bg-[#E34A26]/10 border-[#E34A26]/30 text-[#E34A26]'
                  }`}>
                    {activeVersion?.estadoAprobacion || 'En Cotización'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {proyecto.versiones.length > 1 && (
            <div className={`flex items-center rounded-xl p-1 border ${
              isDarkMode ? 'bg-slate-900 border-white/10' : 'bg-slate-100 border-slate-200'
            }`}>
              {proyecto.versiones.map((v, idx) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVersionIdx(idx)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                    selectedVersionIdx === idx
                      ? 'bg-[#E34A26] text-white font-bold shadow-sm'
                      : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
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
            className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all flex items-center gap-1.5 disabled:opacity-40 ${
              isDarkMode 
                ? 'bg-slate-900 hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 border-white/10 hover:border-amber-500/30' 
                : 'bg-white hover:bg-amber-50 text-slate-600 hover:text-amber-700 border-slate-200 hover:border-amber-400 shadow-sm'
            }`}
            title="Restablecer presupuesto leyendo los datos originales de HETMO"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden md:inline">Reimportar HETMO</span>
          </button>
        </div>
      </header>

      {/* STEPPER HORIZONTAL DE LOS 5 PASOS */}
      <div className={`border-b px-4 sm:px-8 py-3 overflow-x-auto transition-colors ${
        isDarkMode ? 'bg-slate-950/60 border-white/[0.06]' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 min-w-max">
          {[
            { step: 1, label: 'Datos & Cliente' },
            { step: 2, label: 'Revisión de Líneas' },
            { step: 3, label: 'Analítica de Materiales' },
            { step: 4, label: 'Hoja de Fijación' },
            { step: 5, label: 'Consolidación & PDF' },
          ].map((s, idx) => (
            <React.Fragment key={s.step}>
              <button
                onClick={() => setCurrentStep(s.step as any)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  currentStep === s.step
                    ? isDarkMode
                      ? 'bg-[#E34A26]/20 text-[#FF6B4A] border border-[#E34A26]/40 shadow-sm'
                      : 'bg-[#E34A26]/10 text-[#E34A26] border border-[#E34A26]/30 shadow-sm font-bold'
                    : isDarkMode
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  currentStep === s.step
                    ? 'bg-[#E34A26] text-white'
                    : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'
                }`}>
                  {s.step}
                </span>
                <span>{s.label}</span>
              </button>
              {idx < 4 && (
                <span className={`font-bold ${isDarkMode ? 'text-slate-700' : 'text-slate-300'}`}>➔</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-6xl w-full mx-auto space-y-6">
        
        {/* PASO 1 */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-fade-in">
            
            {/* Tarjetas de Resumen Técnico */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className={`p-4 rounded-2xl border flex items-center gap-3.5 ${
                isDarkMode ? 'bg-slate-900/60 border-white/5' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isDarkMode ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-blue-50 text-blue-600 border border-blue-100'
                }`}>
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <div className={`text-[11px] uppercase tracking-wider font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Total Ventanas</div>
                  <div className={`text-lg font-bold font-mono ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                    {activeVersion?.totalVentanas || 0}
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-2xl border flex items-center gap-3.5 ${
                isDarkMode ? 'bg-slate-900/60 border-white/5' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isDarkMode ? 'bg-[#E34A26]/10 text-[#FF6B4A] border border-[#E34A26]/20' : 'bg-[#E34A26]/10 text-[#E34A26] border border-[#E34A26]/20'
                }`}>
                  <Ruler className="w-5 h-5" />
                </div>
                <div>
                  <div className={`text-[11px] uppercase tracking-wider font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Superficie Total</div>
                  <div className={`text-lg font-bold font-mono ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                    {formatNumber(activeVersion?.totalM2Ventanas, 2)} <span className="text-xs font-normal opacity-70">m²</span>
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-2xl border flex items-center gap-3.5 ${
                isDarkMode ? 'bg-slate-900/60 border-white/5' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isDarkMode ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                }`}>
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <div className={`text-[11px] uppercase tracking-wider font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Materiales Base</div>
                  <div className={`text-lg font-bold font-mono ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                    {activeVersion?.totalMateriales || 0}
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-2xl border flex items-center gap-3.5 ${
                isDarkMode ? 'bg-slate-900/60 border-white/5' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isDarkMode ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                }`}>
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <div className={`text-[11px] uppercase tracking-wider font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Importe Base HETMO</div>
                  <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {activeVersion?.monedaSimbolo || '$'} {formatNumber(activeVersion?.importeTotal, 0)}
                  </div>
                </div>
              </div>
            </div>

            {/* SECCIÓN 1: CLIENTE */}
            <div className={`p-6 rounded-2xl border space-y-4 ${
              isDarkMode ? 'bg-slate-900/50 border-white/[0.08]' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <User className="w-4 h-4 text-[#E34A26]" />
                  <span>1. Identificación y Registro del Cliente</span>
                </div>
                <span className={`text-xs font-medium flex items-center gap-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  <Info className="w-3.5 h-3.5 text-[#E34A26]" /> Maestro de clientes oficial
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className={`text-xs font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Razón Social / Nombre Comercial</label>
                  <input
                    type="text"
                    value={clienteNombre}
                    onChange={(e) => setClienteNombre(e.target.value)}
                    placeholder="Ej: Constructora Inmobiliaria SpA"
                    className={`w-full px-3.5 py-2 rounded-xl border text-xs font-semibold focus:outline-none focus:border-[#E34A26] transition-colors ${
                      isDarkMode ? 'bg-slate-950/70 border-white/10 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className={`text-xs font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>RUT / Identificador Fiscal</label>
                  <input
                    type="text"
                    value={clienteRut}
                    onChange={(e) => setClienteRut(e.target.value)}
                    placeholder="Ej: 76.123.456-7"
                    className={`w-full px-3.5 py-2 rounded-xl border text-xs font-mono font-semibold focus:outline-none focus:border-[#E34A26] transition-colors ${
                      isDarkMode ? 'bg-slate-950/70 border-white/10 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className={`text-xs font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Giro Comercial</label>
                  <input
                    type="text"
                    value={clienteGiro}
                    onChange={(e) => setClienteGiro(e.target.value)}
                    placeholder="Ej: Construcción y Obras Civiles"
                    className={`w-full px-3.5 py-2 rounded-xl border text-xs focus:outline-none focus:border-[#E34A26] transition-colors ${
                      isDarkMode ? 'bg-slate-950/70 border-white/10 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className={`text-xs font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Contacto Principal (Nombre)</label>
                  <input
                    type="text"
                    value={clienteContacto}
                    onChange={(e) => setClienteContacto(e.target.value)}
                    placeholder="Ej: Juan Pérez (Jefe de Obra)"
                    className={`w-full px-3.5 py-2 rounded-xl border text-xs focus:outline-none focus:border-[#E34A26] transition-colors ${
                      isDarkMode ? 'bg-slate-950/70 border-white/10 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className={`text-xs font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Dirección de Obra / Facturación</label>
                  <input
                    type="text"
                    value={clienteDireccion}
                    onChange={(e) => setClienteDireccion(e.target.value)}
                    placeholder="Ej: Av. Las Condes 1234"
                    className={`w-full px-3.5 py-2 rounded-xl border text-xs focus:outline-none focus:border-[#E34A26] transition-colors ${
                      isDarkMode ? 'bg-slate-950/70 border-white/10 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className={`text-xs font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Comuna / Ciudad</label>
                  <input
                    type="text"
                    value={clienteLocalidad}
                    onChange={(e) => setClienteLocalidad(e.target.value)}
                    placeholder="Ej: Santiago, Región Metropolitana"
                    className={`w-full px-3.5 py-2 rounded-xl border text-xs focus:outline-none focus:border-[#E34A26] transition-colors ${
                      isDarkMode ? 'bg-slate-950/70 border-white/10 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className={`text-xs font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Teléfono de Contacto</label>
                  <input
                    type="text"
                    value={clienteTelefono}
                    onChange={(e) => setClienteTelefono(e.target.value)}
                    placeholder="+56 9 1234 5678"
                    className={`w-full px-3.5 py-2 rounded-xl border text-xs focus:outline-none focus:border-[#E34A26] transition-colors ${
                      isDarkMode ? 'bg-slate-950/70 border-white/10 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className={`text-xs font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Correo Electrónico</label>
                  <input
                    type="text"
                    value={clienteEmail}
                    onChange={(e) => setClienteEmail(e.target.value)}
                    placeholder="contacto@constructora.cl"
                    className={`w-full px-3.5 py-2 rounded-xl border text-xs focus:outline-none focus:border-[#E34A26] transition-colors ${
                      isDarkMode ? 'bg-slate-950/70 border-white/10 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* SECCIÓN 2: DIVISAS */}
            <div className={`p-6 rounded-2xl border space-y-4 ${
              isDarkMode ? 'bg-slate-900/50 border-white/[0.08]' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Coins className="w-4 h-4 text-[#E34A26]" />
                  <span>2. Parámetros Económicos y Divisas de la Obra</span>
                </div>
                <span className={`text-[11px] font-mono ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Valores específicos para este presupuesto
                </span>
              </div>

              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Define los tipos de cambio para convertir las compras internacionales (USD/EUR) al costo real en pesos chilenos y cotizar en UF.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className={`p-4 rounded-xl border space-y-2 ${
                  isDarkMode ? 'bg-slate-950/70 border-white/10' : 'bg-slate-50 border-slate-200'
                }`}>
                  <label className={`text-xs font-semibold flex items-center justify-between ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    <span>Dólar Observado (USD)</span>
                    <span className="text-[10px] text-[#E34A26] font-mono font-bold">$ CLP</span>
                  </label>
                  <input
                    type="number"
                    value={dolar}
                    onChange={(e) => setDolar(e.target.value)}
                    placeholder="950.00"
                    className={`w-full px-3 py-2 rounded-lg border font-mono font-bold text-sm focus:outline-none focus:border-[#E34A26] transition-colors ${
                      isDarkMode ? 'bg-slate-900 border-white/10 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  />
                </div>

                <div className={`p-4 rounded-xl border space-y-2 ${
                  isDarkMode ? 'bg-slate-950/70 border-white/10' : 'bg-slate-50 border-slate-200'
                }`}>
                  <label className={`text-xs font-semibold flex items-center justify-between ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    <span>Unidad de Fomento (UF)</span>
                    <span className="text-[10px] text-[#E34A26] font-mono font-bold">$ CLP</span>
                  </label>
                  <input
                    type="number"
                    value={uf}
                    onChange={(e) => setUf(e.target.value)}
                    placeholder="38500.00"
                    className={`w-full px-3 py-2 rounded-lg border font-mono font-bold text-sm focus:outline-none focus:border-[#E34A26] transition-colors ${
                      isDarkMode ? 'bg-slate-900 border-white/10 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  />
                </div>

                <div className={`p-4 rounded-xl border space-y-2 ${
                  isDarkMode ? 'bg-slate-950/70 border-white/10' : 'bg-slate-50 border-slate-200'
                }`}>
                  <label className={`text-xs font-semibold flex items-center justify-between ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    <span>Euro Oficial (EUR)</span>
                    <span className="text-[10px] text-[#E34A26] font-mono font-bold">$ CLP</span>
                  </label>
                  <input
                    type="number"
                    value={euro}
                    onChange={(e) => setEuro(e.target.value)}
                    placeholder="1030.00"
                    className={`w-full px-3 py-2 rounded-lg border font-mono font-bold text-sm focus:outline-none focus:border-[#E34A26] transition-colors ${
                      isDarkMode ? 'bg-slate-900 border-white/10 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* SECCIÓN 3: TIPOLOGÍAS IMPORTADAS */}
            <div className={`p-6 rounded-2xl border space-y-4 ${
              isDarkMode ? 'bg-slate-900/50 border-white/[0.08]' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <FileSpreadsheet className="w-4 h-4 text-[#E34A26]" />
                  <span>3. Tipologías Importadas de Fábrica ({ventanas.length} modelos)</span>
                </div>
                <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Total: <strong className={`font-mono ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>{activeVersion?.totalVentanas} ventanas</strong>
                </span>
              </div>

              <div className={`overflow-x-auto max-h-60 rounded-xl border ${
                isDarkMode ? 'border-white/10' : 'border-slate-200'
              }`}>
                <table className={`w-full text-left text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  <thead className={`text-[11px] uppercase tracking-wider sticky top-0 ${
                    isDarkMode ? 'bg-slate-950 text-slate-400' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Línea</th>
                      <th className="px-4 py-2.5 font-semibold">Modelo</th>
                      <th className="px-4 py-2.5 font-semibold text-center">Uds</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Dimensiones (mm)</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Superficie (m²)</th>
                      <th className="px-4 py-2.5 font-semibold">Acabado</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDarkMode ? 'divide-white/5' : 'divide-slate-200'}`}>
                    {ventanas.map((v) => (
                      <tr key={v.id} className={isDarkMode ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'}>
                        <td className={`px-4 py-2.5 font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>#{v.lineaHetmo}</td>
                        <td className={`px-4 py-2.5 font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>{v.modelo}</td>
                        <td className="px-4 py-2.5 text-center font-bold text-[#E34A26]">{v.unidades}</td>
                        <td className="px-4 py-2.5 text-right font-mono">{formatNumber(v.anchoMm, 0)} × {formatNumber(v.altoMm, 0)}</td>
                        <td className={`px-4 py-2.5 text-right font-mono font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{formatNumber(v.m2Ventana, 2)}</td>
                        <td className={`px-4 py-2.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{v.acabadoCodigo || 'Estándar'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PASO 2 */}
        {currentStep === 2 && (
          <div className={`p-12 text-center space-y-3 rounded-2xl border animate-fade-in ${
            isDarkMode ? 'bg-slate-900/40 border-white/10' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="w-12 h-12 rounded-2xl bg-[#E34A26]/10 border border-[#E34A26]/30 flex items-center justify-center text-[#E34A26] mx-auto">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold">Paso 2: Revisión de Líneas y Tipologías</h3>
            <p className={`text-xs max-w-md mx-auto ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Inspección técnica de cada ventana con sus medidas, aperturas, comentarios de taller y precios unitarios.
            </p>
          </div>
        )}

        {/* PASO 3 */}
        {currentStep === 3 && (
          <div className={`p-12 text-center space-y-3 rounded-2xl border animate-fade-in ${
            isDarkMode ? 'bg-slate-900/40 border-white/10' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="w-12 h-12 rounded-2xl bg-[#E34A26]/10 border border-[#E34A26]/30 flex items-center justify-center text-[#E34A26] mx-auto">
              <Boxes className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold">Paso 3: Analítica de Materiales</h3>
            <p className={`text-xs max-w-md mx-auto ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Ajuste macro de precios en moneda origen, reclasificación de familias, exclusión de vidrios fantasma y sustitución de productos.
            </p>
          </div>
        )}

        {/* PASO 4 */}
        {currentStep === 4 && (
          <div className={`p-12 text-center space-y-3 rounded-2xl border animate-fade-in ${
            isDarkMode ? 'bg-slate-900/40 border-white/10' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="w-12 h-12 rounded-2xl bg-[#E34A26]/10 border border-[#E34A26]/30 flex items-center justify-center text-[#E34A26] mx-auto">
              <Calculator className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold">Paso 4: Hoja de Fijación y Extras</h3>
            <p className={`text-xs max-w-md mx-auto ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Cálculo de fijaciones, tornillería, sellantes, grúas, traslados y mano de obra de instalación.
            </p>
          </div>
        )}

        {/* PASO 5 */}
        {currentStep === 5 && (
          <div className={`p-12 text-center space-y-3 rounded-2xl border animate-fade-in ${
            isDarkMode ? 'bg-slate-900/40 border-white/10' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="w-12 h-12 rounded-2xl bg-[#E34A26]/10 border border-[#E34A26]/30 flex items-center justify-center text-[#E34A26] mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold">Paso 5: Consolidación, Aprobación & PDF</h3>
            <p className={`text-xs max-w-md mx-auto ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Resumen comercial, control de Aprobación de Gerencia y generación del Presupuesto final en PDF.
            </p>
          </div>
        )}

      </main>

      {/* FOOTER INFERIOR */}
      <footer className={`sticky bottom-0 z-30 backdrop-blur-md border-t px-4 sm:px-8 py-3.5 flex items-center justify-between transition-colors ${
        isDarkMode ? 'bg-slate-950/95 border-white/[0.08]' : 'bg-white/95 border-slate-200 shadow-lg'
      }`}>
        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5 animate-fade-in">
              <CheckCircle2 className="w-4 h-4" /> Parámetros guardados con éxito en la base de datos
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {currentStep > 1 && (
            <button
              onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors border ${
                isDarkMode ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-white/10' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
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
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#E34A26] to-[#C13615] hover:from-[#FF6B4A] hover:to-[#E34A26] text-white font-bold text-xs shadow-lg shadow-[#E34A26]/20 transition-all flex items-center gap-2"
            >
              <span>Guardar y Pasar a Revisión de Líneas</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {currentStep > 1 && currentStep < 5 && (
            <button
              onClick={() => setCurrentStep((prev) => (prev + 1) as any)}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#E34A26] to-[#C13615] hover:from-[#FF6B4A] hover:to-[#E34A26] text-white font-bold text-xs shadow-lg shadow-[#E34A26]/20 transition-all flex items-center gap-2"
            >
              <span>Continuar al Paso {currentStep + 1}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </footer>

      {/* MODAL REIMPORTAR HETMO */}
      {showReimportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 border ${
            isDarkMode ? 'bg-[#0F1523] border-amber-500/30' : 'bg-white border-amber-300'
          }`}>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className={`text-base font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>¿Reimportar desde HETMO?</h3>
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Esta acción volverá a leer los datos crudos desde SQL Server. Si realizaste modificaciones personalizadas de precios o sustituciones en esta versión, se restablecerán a los valores originales de fábrica.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowReimportModal(false)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                  isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
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
