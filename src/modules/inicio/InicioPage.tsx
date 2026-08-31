import React, { useState } from 'react';
import {
  Building2,
  Hammer,
  Package,
  ArrowRight,
  Clock,
  Flame,
  Boxes,
  Ruler,
  Calendar,
  TrendingUp,
  Search,
  X,
} from 'lucide-react';
import { StatCard } from '../../components/ui/StatCard';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useIndicadoresChile } from '../../lib/useIndicadoresChile';
import { formatNumber } from '../../lib/utils';

interface InicioPageProps {
  onNavigate: (tabId: string, search?: string) => void;
}

interface ProyectoComercialMock {
  id: string;
  codigo: string;
  obra: string;
  cliente: string;
  m2Total: number;
  unidades: number;
  etapa: 'PLANIFICACION' | 'CORTE' | 'ENSAMBLAJE' | 'DESPACHO';
  progreso: number;
  fechaEntrega: string;
}

const OBRAS_APROBADAS_MOCK: ProyectoComercialMock[] = [
  {
    id: 'ob-1',
    codigo: 'OBR-2026-042',
    obra: 'Edificio Los Aromos - Etapa 2',
    cliente: 'Constructora Moller & Pérez',
    m2Total: 480.5,
    unidades: 124,
    etapa: 'CORTE',
    progreso: 45,
    fechaEntrega: '15 Mar 2026',
  },
  {
    id: 'ob-2',
    codigo: 'OBR-2026-039',
    obra: 'Condominio Alto Las Pircas',
    cliente: 'Inmobiliaria Aconcagua',
    m2Total: 620.0,
    unidades: 168,
    etapa: 'ENSAMBLAJE',
    progreso: 70,
    fechaEntrega: '28 Mar 2026',
  },
  {
    id: 'ob-3',
    codigo: 'OBR-2026-048',
    obra: 'Casa Habitación San Damián',
    cliente: 'Arq. Rodrigo Valenzuela',
    m2Total: 145.2,
    unidades: 26,
    etapa: 'DESPACHO',
    progreso: 95,
    fechaEntrega: '05 Mar 2026',
  },
  {
    id: 'ob-4',
    codigo: 'OBR-2026-051',
    obra: 'Colegio Saint George - Pabellón C',
    cliente: 'Ingevec S.A.',
    m2Total: 310.8,
    unidades: 82,
    etapa: 'PLANIFICACION',
    progreso: 15,
    fechaEntrega: '10 Abr 2026',
  },
];

export const InicioPage: React.FC<InicioPageProps> = ({ onNavigate }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const { indicadores, feriadoInfo } = useIndicadoresChile();

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (searchQuery.trim()) {
      onNavigate('cotizaciones', searchQuery.trim());
    }
  };

  const etapasConfig: Record<
    string,
    { label: string; variant: any; barColor: string }
  > = {
    PLANIFICACION: {
      label: 'Ingeniería / Planificación',
      variant: 'subtle',
      barColor: 'bg-slate-400',
    },
    CORTE: {
      label: 'Corte & Mecanizado',
      variant: 'brand',
      barColor: 'bg-[#E34A26]',
    },
    ENSAMBLAJE: {
      label: 'Armado & Vidriado',
      variant: 'info',
      barColor: 'bg-sky-500',
    },
    DESPACHO: {
      label: 'Control Calidad & Despacho',
      variant: 'success',
      barColor: 'bg-emerald-500',
    },
  };

  const todayStr = new Intl.DateTimeFormat('es-CL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  return (
    <div className="p-3 sm:p-5 md:p-8 space-y-4 sm:space-y-6 max-w-7xl mx-auto animate-fade-in">
      {/* BUSCADOR PRINCIPAL EN EL CONTENIDO */}
      <form onSubmit={handleSearchSubmit} className="relative w-full">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar obra, cliente, RUT o presupuesto HETMO..."
          className="w-full pl-11 pr-24 py-3 sm:py-3.5 rounded-2xl bg-white border border-slate-200/90 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#E34A26] focus:ring-2 focus:ring-[#E34A26]/10 shadow-xs transition-all"
        />
        {searchQuery ? (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label="Limpiar búsqueda"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-xl bg-[#E34A26] hover:bg-[#c93d1b] text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
            >
              Buscar
            </button>
          </div>
        ) : (
          <span className="hidden sm:block absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-mono text-slate-400">
            Presiona Enter ↵
          </span>
        )}
      </form>

      {/* HERO OPERATIVO MTW ERP */}
      <div className="relative overflow-hidden bg-linear-to-r from-slate-950 via-slate-900 to-slate-950 rounded-3xl p-5 sm:p-7 md:p-8 text-white shadow-xl border border-slate-800">
        <div className="relative z-10 space-y-5">
          {/* Header Superior del Hero */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white flex items-center gap-2.5">
                <span>MTW ERP</span>
              </h1>

              {/* Fecha y Feriados debajo del título */}
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <span className="text-xs sm:text-sm text-slate-300 font-medium capitalize whitespace-nowrap flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#E34A26]" />
                  {todayStr}
                </span>
                {feriadoInfo?.hoyFeriado && (
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold whitespace-nowrap">
                    {feriadoInfo.hoyFeriado}
                  </span>
                )}
                {feriadoInfo?.proximoFeriado && (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono whitespace-nowrap">
                    {feriadoInfo.proximoFeriado}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 self-start md:self-auto">
              <Button
                variant="primary"
                size="md"
                leftIcon={<Building2 className="w-4 h-4" />}
                rightIcon={<ArrowRight className="w-4 h-4" />}
                onClick={() => onNavigate('cotizaciones')}
                className="w-full sm:w-auto"
              >
                Ir a Cotizaciones
              </Button>
            </div>
          </div>

          {/* BARRA DE INDICADORES FINANCIEROS DEL DÍA (UF, DOLAR, EURO, UTM) */}
          <div className="pt-4 border-t border-slate-800/80">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-[#E34A26]" />
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                Indicadores Financieros de Hoy (Chile)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* UF */}
              <div className="px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-400">UF</span>
                <span className="font-mono font-bold text-xs sm:text-sm text-[#00F2FE] whitespace-nowrap">
                  ${formatNumber(indicadores?.uf, 2)}
                </span>
              </div>

              {/* Dólar */}
              <div className="px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-400">DÓLAR</span>
                <span className="font-mono font-bold text-xs sm:text-sm text-emerald-400 whitespace-nowrap">
                  ${formatNumber(indicadores?.dolar, 2)}
                </span>
              </div>

              {/* Euro */}
              <div className="px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-400">EURO</span>
                <span className="font-mono font-bold text-xs sm:text-sm text-sky-400 whitespace-nowrap">
                  ${formatNumber(indicadores?.euro, 2)}
                </span>
              </div>

              {/* UTM */}
              <div className="px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-400">UTM</span>
                <span className="font-mono font-bold text-xs sm:text-sm text-amber-400 whitespace-nowrap">
                  ${formatNumber(indicadores?.utm, 0)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Resplandor decorativo de fondo */}
        <div className="absolute -right-16 -bottom-16 w-72 h-72 bg-[#E34A26]/15 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* KPIS DE OBRAS APROBADAS Y PRODUCCIÓN */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-[#E34A26]" />
            <span>Métricas Operativas de Planta (Obras Aprobadas)</span>
          </h2>
          <span className="text-[11px] font-mono text-slate-400 hidden sm:inline whitespace-nowrap">
            Estructura Comercial
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
          <StatCard
            title="Obras en Fabricación"
            value="4"
            unit="obras"
            subtitle="Con orden aprobada"
            icon={Building2}
            iconColor="text-slate-900"
            iconBgColor="bg-slate-100 border-slate-200"
            trend={{ label: 'En proceso', positive: true }}
          />

          <StatCard
            title="Superficie en Cola"
            value="1.556"
            unit="m²"
            subtitle="Metros cuadrados totales"
            icon={Ruler}
            iconColor="text-[#E34A26]"
            iconBgColor="bg-[#E34A26]/10 border-[#E34A26]/20"
            trend={{ label: '85% capacidad', positive: true }}
          />

          <StatCard
            title="Ventanas en Línea"
            value="400"
            unit="unidades"
            subtitle="Despiece en taller"
            icon={Boxes}
            iconColor="text-sky-600"
            iconBgColor="bg-sky-50 border-sky-200"
            trend={{ label: '4 tipologías' }}
          />

          <StatCard
            title="Entregas del Mes"
            value="2"
            unit="proyectos"
            subtitle="Comprometidos en Marzo"
            icon={Calendar}
            iconColor="text-emerald-600"
            iconBgColor="bg-emerald-50 border-emerald-200"
            trend={{ label: 'Al día', positive: true }}
          />
        </div>
      </div>

      {/* PIPELINE DE OBRAS APROBADAS EN EJECUCIÓN */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm sm:text-base font-black tracking-tight text-slate-900 flex items-center gap-2">
              <span>Pipeline de Producción & Obras Aprobadas</span>
            </h3>
            <p className="text-xs text-slate-500">
              Seguimiento del estado de avance en planta de los proyectos con orden de trabajo.
            </p>
          </div>
          <Badge variant="subtle" size="sm">
            Estructura para API Comercial
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {OBRAS_APROBADAS_MOCK.map((obra) => {
            const etapaInfo = etapasConfig[obra.etapa];

            return (
              <div
                key={obra.id}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 hover:bg-white transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 whitespace-nowrap">
                      {obra.codigo}
                    </span>
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 mt-1">
                      {obra.obra}
                    </h4>
                    <p className="text-[11px] text-slate-600 font-medium">
                      {obra.cliente}
                    </p>
                  </div>
                  <Badge variant={etapaInfo.variant} size="sm">
                    {etapaInfo.label}
                  </Badge>
                </div>

                {/* Barra de Progreso */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-500">Avance de Fabricación</span>
                    <span className="font-bold text-slate-800">{obra.progreso}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${etapaInfo.barColor}`}
                      style={{ width: `${obra.progreso}%` }}
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <div className="flex items-center gap-3">
                    <span>
                      <strong className="text-slate-800">{obra.m2Total}</strong> m²
                    </span>
                    <span>
                      <strong className="text-slate-800">{obra.unidades}</strong> un
                    </span>
                  </div>
                  <span className="flex items-center gap-1 text-slate-600 font-semibold whitespace-nowrap">
                    <Clock className="w-3 h-3 text-[#E34A26]" />
                    {obra.fechaEntrega}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ACCESOS DIRECTOS A MÓDULOS DE LA PLATAFORMA */}
      <div>
        <div className="mb-3 px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Módulos del Sistema MTW ERP
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* Tarjeta Cotizaciones */}
          <div
            onClick={() => onNavigate('cotizaciones')}
            className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-[#E34A26]/40 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-4"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-[#E34A26]/10 border border-[#E34A26]/20 flex items-center justify-center text-[#E34A26]">
                  <Building2 className="w-5 h-5" />
                </div>
                <Badge variant="brand" size="sm">
                  Activo
                </Badge>
              </div>
              <h3 className="font-bold text-sm text-slate-900 group-hover:text-[#E34A26] transition-colors">
                Cotizaciones & Presupuestos
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Importación y presupuestación de obras HETMO, cotizador por fases y catálogo maestro de materiales.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#E34A26]">
              <span>Ingresar a Cotizaciones</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Tarjeta Taller */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between space-y-4 opacity-80">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
                  <Hammer className="w-5 h-5" />
                </div>
                <Badge variant="subtle" size="sm">
                  Pronto
                </Badge>
              </div>
              <h3 className="font-bold text-sm text-slate-900">
                Taller & Fabricación
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Optimización de cortes, hojas de fabricación, ensamblaje y control de calidad en piso de planta.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 text-xs font-semibold text-slate-400">
              En desarrollo
            </div>
          </div>

          {/* Tarjeta Maestro / Materiales */}
          <div
            onClick={() => onNavigate('cotizaciones')}
            className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-4"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                  <Package className="w-5 h-5" />
                </div>
                <Badge variant="default" size="sm">
                  En Cotizaciones
                </Badge>
              </div>
              <h3 className="font-bold text-sm text-slate-900 group-hover:text-[#E34A26] transition-colors">
                Maestro de Productos
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Catálogo general de perfiles, termopaneles, sellos y accesorios con precios y divisas de origen.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-700">
              <span>Gestionar catálogo</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
