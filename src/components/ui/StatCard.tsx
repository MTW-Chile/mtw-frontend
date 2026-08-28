import React from 'react';
import type { LucideIcon } from 'lucide-react';

export interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
  trend?: {
    label: string;
    positive?: boolean;
  };
  onClick?: () => void;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  unit,
  subtitle,
  icon: Icon,
  iconColor = 'text-[#E34A26]',
  iconBgColor = 'bg-[#E34A26]/10 border-[#E34A26]/20',
  trend,
  onClick,
  className = '',
}) => {
  return (
    <div
      onClick={onClick}
      className={`p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">
            {title}
          </p>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 font-mono">
              {value}
            </span>
            {unit && (
              <span className="text-xs font-semibold text-slate-500 font-sans whitespace-nowrap">
                {unit}
              </span>
            )}
          </div>
        </div>

        <div
          className={`p-2 sm:p-2.5 rounded-xl border flex items-center justify-center shrink-0 ${iconBgColor} ${iconColor}`}
        >
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>

      {(subtitle || trend) && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs text-slate-500">
          {subtitle && (
            <span className="truncate text-[11px] sm:text-xs">{subtitle}</span>
          )}
          {trend && (
            <span
              className={`font-semibold text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${
                trend.positive
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                  : 'bg-slate-100 text-slate-600 border border-slate-200/60'
              }`}
            >
              {trend.label}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
