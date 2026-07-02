// Cálculo financiero del dominio (PROMPT.md §4 RF-03, §5 precisión).
// Todos los importes en CÉNTIMOS (enteros) y las tasas en PUNTOS BÁSICOS.
// Los redondeos se hacen una única vez por pago, a céntimo (Math.round).

import type { PaymentFrequency, Term } from "./types";

export const BPS = 10_000; // 100% en puntos básicos

export const PAYMENTS_PER_YEAR: Record<PaymentFrequency, number> = {
  annual: 1,
  semiannual: 2,
  quarterly: 4,
};

/** Clasificación por plazo (RF-01): ≤3 años corto, ≤7 medio, resto largo. */
export function termFor(issueDate: Date, maturity: Date): Term {
  const years =
    (maturity.getTime() - issueDate.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (years <= 3) return "corto";
  if (years <= 7) return "medio";
  return "largo";
}

/** Importe de un cupón por título: nominal × tasa periódica. */
export function couponAmountCents(
  faceValueCents: number,
  couponBps: number,
  frequency: PaymentFrequency
): number {
  return Math.round(
    (faceValueCents * couponBps) / BPS / PAYMENTS_PER_YEAR[frequency]
  );
}

export interface ScheduledFlow {
  dueDate: Date;
  type: "coupon" | "principal";
  amountCents: number;
}

/**
 * Calendario de flujos de un título (RF-03): cupones periódicos desde la
 * emisión hasta el vencimiento + devolución del principal al vencimiento.
 * Las fechas se generan sumando meses a la fecha de emisión (sin drift).
 */
export function buildSchedule(params: {
  faceValueCents: number;
  couponBps: number;
  frequency: PaymentFrequency;
  issueDate: Date;
  maturity: Date;
  units: number;
}): ScheduledFlow[] {
  const { faceValueCents, couponBps, frequency, issueDate, maturity, units } = params;
  const stepMonths = 12 / PAYMENTS_PER_YEAR[frequency];
  const coupon = couponAmountCents(faceValueCents, couponBps, frequency) * units;
  const flows: ScheduledFlow[] = [];

  let i = 1;
  for (;;) {
    const due = addMonths(issueDate, stepMonths * i);
    if (due.getTime() > maturity.getTime()) break;
    flows.push({ dueDate: due, type: "coupon", amountCents: coupon });
    if (due.getTime() === maturity.getTime()) break;
    i++;
  }
  flows.push({
    dueDate: maturity,
    type: "principal",
    amountCents: faceValueCents * units,
  });
  return flows;
}

function addMonths(base: Date, months: number): Date {
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + months, base.getUTCDate()));
  // Si el día no existe en el mes destino (31 → feb), Date lo desborda; recortar al último día.
  if (d.getUTCDate() !== base.getUTCDate()) d.setUTCDate(0);
  return d;
}

/**
 * Precio de mercado derivado del modelo (sin cotizaciones externas):
 * valor presente de los flujos restantes de UN título descontados a la tasa
 * exigida según el rating vigente del emisor. Devuelve céntimos por título.
 */
export const REQUIRED_YIELD_BY_RATING_BPS: Record<string, number> = {
  AAA: 250,
  AA: 300,
  A: 375,
  BBB: 475,
  BB: 650,
  B: 900,
  CCC: 1400,
};

export function marketPriceCents(params: {
  faceValueCents: number;
  couponBps: number;
  frequency: PaymentFrequency;
  issueDate: Date;
  maturity: Date;
  rating: string;
  asOf: Date;
}): number {
  const { faceValueCents, couponBps, frequency, issueDate, maturity, rating, asOf } = params;
  const flows = buildSchedule({ faceValueCents, couponBps, frequency, issueDate, maturity, units: 1 });
  const yBps = REQUIRED_YIELD_BY_RATING_BPS[rating] ?? 500;
  const perYear = PAYMENTS_PER_YEAR[frequency];
  const periodRate = yBps / BPS / perYear;

  let pv = 0;
  for (const f of flows) {
    const years = (f.dueDate.getTime() - asOf.getTime()) / (365.25 * 24 * 3600 * 1000);
    if (years <= 0) continue; // flujo ya pagado
    const periods = years * perYear;
    pv += f.amountCents / Math.pow(1 + periodRate, periods);
  }
  return Math.round(pv);
}

/**
 * YTM aproximada (bisección) dado un precio en céntimos por título.
 * Devuelve puntos básicos anuales. Para el screener (RF-05).
 */
export function ytmBps(params: {
  priceCents: number;
  faceValueCents: number;
  couponBps: number;
  frequency: PaymentFrequency;
  issueDate: Date;
  maturity: Date;
  asOf: Date;
}): number {
  const { priceCents, ...bond } = params;
  const flows = buildSchedule({ ...bond, units: 1 });
  const perYear = PAYMENTS_PER_YEAR[bond.frequency];

  const pvAt = (annualBps: number) => {
    const periodRate = annualBps / BPS / perYear;
    let pv = 0;
    for (const f of flows) {
      const years = (f.dueDate.getTime() - bond.asOf.getTime()) / (365.25 * 24 * 3600 * 1000);
      if (years <= 0) continue;
      pv += f.amountCents / Math.pow(1 + periodRate, years * perYear);
    }
    return pv;
  };

  let lo = 1; // 0.01%
  let hi = 50_000; // 500%
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (pvAt(mid) > priceCents) lo = mid;
    else hi = mid;
  }
  return Math.round((lo + hi) / 2);
}
