/* eslint-disable react/forbid-elements -- los elementos de tabla viven solo aquí */
import React from 'react';
import { TABLE_CLASS, TABLE_WRAPPER_CLASS } from '../../lib/designSystem';

/**
 * Tabla única (DESIGN.md 5): el contenedor hace scroll horizontal dentro de
 * su tarjeta (nunca desborda la página), padding de celdas parejo,
 * encabezados en mayúsculas y números a la derecha.
 *
 *   <Tabla>
 *     <Thead><Tr><Th>SKU</Th><Th alinear="derecha">Monto</Th></Tr></Thead>
 *     <Tbody>
 *       {filas.map((f) => <Tr key={f.id}><Td>…</Td><Td alinear="derecha" numero>…</Td></Tr>)}
 *       {filas.length === 0 && <FilaVacia columnas={2}>Sin datos.</FilaVacia>}
 *     </Tbody>
 *   </Tabla>
 */
export const Tabla: React.FC<{ children: React.ReactNode; className?: string; ajustada?: boolean }> = ({ children, className = '', ajustada }) => (
  <div className={TABLE_WRAPPER_CLASS}>
    <table className={`${TABLE_CLASS} text-left text-slate-700 ${ajustada ? '[&_td]:py-1.5 [&_th]:py-2' : '[&_td]:py-2.5 [&_th]:py-3'} ${className}`}>{children}</table>
  </div>
);

export const Thead: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <thead className="bg-slate-50/80 border-b border-slate-200 uppercase">{children}</thead>
);

export const Tbody: React.FC<{ children: React.ReactNode }> = ({ children }) => <tbody className="divide-y divide-slate-100">{children}</tbody>;

type Alinear = 'izquierda' | 'centro' | 'derecha';
const ALINEAR: Record<Alinear, string> = { izquierda: 'text-left', centro: 'text-center', derecha: 'text-right' };

export const Th: React.FC<React.ThHTMLAttributes<HTMLTableCellElement> & { alinear?: Alinear }> = ({ alinear = 'izquierda', className = '', ...props }) => (
  <th className={`${ALINEAR[alinear]} ${className}`} {...props} />
);

/** tono: 'advertencia' (ámbar: por revisar), 'atenuada' (excluida, inactiva), 'destacada'. */
export const Tr: React.FC<React.HTMLAttributes<HTMLTableRowElement> & { tono?: 'advertencia' | 'atenuada' | 'destacada' | 'peligro' }> = ({
  tono,
  className = '',
  ...props
}) => {
  const fondo =
    tono === 'advertencia' ? 'bg-amber-50/60' : tono === 'atenuada' ? 'opacity-50' : tono === 'destacada' ? 'bg-brand-50/40' : tono === 'peligro' ? 'bg-rose-50/60' : '';
  return <tr className={`hover:bg-slate-50/70 transition-colors ${fondo} ${className}`} {...props} />;
};

/** numero: tabular-nums (alinear a la derecha); mono: códigos y montos en columnas. */
export const Td: React.FC<React.TdHTMLAttributes<HTMLTableCellElement> & { alinear?: Alinear; numero?: boolean; mono?: boolean; fuerte?: boolean }> = ({
  alinear,
  numero,
  mono,
  fuerte,
  className = '',
  ...props
}) => (
  <td
    className={`align-middle ${ALINEAR[alinear ?? (numero ? 'derecha' : 'izquierda')]} ${numero ? 'tabular-nums whitespace-nowrap' : ''} ${mono ? 'font-mono' : ''} ${
      fuerte ? 'font-bold text-slate-900' : ''
    } ${className}`}
    {...props}
  />
);

export const FilaVacia: React.FC<{ columnas: number; children: React.ReactNode }> = ({ columnas, children }) => (
  <tr>
    <td colSpan={columnas} className="py-8 text-center text-xs text-slate-400">
      {children}
    </td>
  </tr>
);
