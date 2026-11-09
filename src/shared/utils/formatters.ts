export function formatMoney(amount: number, currency: 'USD' | 'VES' = 'USD'): string {
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(iso: string, lang: 'es' | 'en' = 'es'): string {
  return new Intl.DateTimeFormat(lang === 'es' ? 'es-VE' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}

export function formatDateTime(iso: string, lang: 'es' | 'en' = 'es'): string {
  return new Intl.DateTimeFormat(lang === 'es' ? 'es-VE' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}
