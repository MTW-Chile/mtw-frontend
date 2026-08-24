import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number | null | undefined, decimals = 2): string {
  if (num === null || num === undefined || isNaN(Number(num))) return '0';
  return new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(num));
}

export function formatCurrency(
  amount: number | null | undefined,
  currency: string | null = 'UF'
): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) return '-';
  const val = formatNumber(amount, currency === 'CLP' ? 0 : 2);
  return `${currency || 'UF'} ${val}`;
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateString;
  }
}