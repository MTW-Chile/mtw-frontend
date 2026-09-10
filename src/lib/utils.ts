export function formatNumber(num: number | null | undefined, decimals = 2): string {
  if (num === null || num === undefined || isNaN(Number(num))) return '0';
  return new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(num));
}