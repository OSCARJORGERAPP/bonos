// Formateo SOLO en la capa de presentación (los datos viajan en céntimos/bps).

export function eur(cents: number): string {
  return (cents / 100).toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
  });
}

export function pct(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

export function fecha(d: string | Date): string {
  return new Date(d).toLocaleDateString("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
