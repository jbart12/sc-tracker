export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatDate(dateString: string): string {
  // Parse as UTC to avoid timezone shifting the displayed date
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function formatPresetAmount(amount: number): string {
  if (amount >= 1000) {
    return `$${amount / 1000}k`;
  }
  return `$${amount}`;
}

export function toISODateString(date: Date): string {
  return date.toISOString().split('T')[0];
}
