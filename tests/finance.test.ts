import { describe, expect, it } from "vitest";
import {
  buildSchedule,
  couponAmountCents,
  marketPriceCents,
  termFor,
  ytmBps,
} from "@/lib/finance";

const issue = new Date(Date.UTC(2026, 0, 15));

describe("RF-01: clasificación por plazo", () => {
  it("corto ≤3 años, medio ≤7, largo >7", () => {
    expect(termFor(issue, new Date(Date.UTC(2028, 0, 15)))).toBe("corto");
    expect(termFor(issue, new Date(Date.UTC(2031, 0, 15)))).toBe("medio");
    expect(termFor(issue, new Date(Date.UTC(2036, 0, 15)))).toBe("largo");
  });
});

describe("RF-03 / precisión: cálculo de cupones en céntimos enteros", () => {
  it("cupón semestral de un bono 4.2% sobre nominal 1000€", () => {
    // 100000 céntimos × 420 bps / 10000 / 2 pagos = 2100 céntimos exactos
    expect(couponAmountCents(100_000, 420, "semiannual")).toBe(2100);
  });

  it("siempre devuelve enteros (0 errores de redondeo acumulado)", () => {
    const c = couponAmountCents(99_999, 333, "quarterly");
    expect(Number.isInteger(c)).toBe(true);
  });
});

describe("RF-03: calendario de flujos (cupones + principal)", () => {
  it("bono a 2 años con cupón anual → 2 cupones + principal al vencimiento", () => {
    const maturity = new Date(Date.UTC(2028, 0, 15));
    const flows = buildSchedule({
      faceValueCents: 100_000,
      couponBps: 500,
      frequency: "annual",
      issueDate: issue,
      maturity,
      units: 10,
    });
    const coupons = flows.filter((f) => f.type === "coupon");
    const principal = flows.filter((f) => f.type === "principal");

    expect(coupons).toHaveLength(2);
    expect(principal).toHaveLength(1);
    // cupón: 100000 × 5% × 10 títulos = 50000 céntimos
    expect(coupons[0].amountCents).toBe(50_000);
    expect(principal[0].amountCents).toBe(1_000_000);
    expect(principal[0].dueDate.getTime()).toBe(maturity.getTime());
  });

  it("frecuencia trimestral genera 4 cupones/año en fechas sin drift", () => {
    const maturity = new Date(Date.UTC(2027, 0, 15));
    const flows = buildSchedule({
      faceValueCents: 100_000, couponBps: 400, frequency: "quarterly",
      issueDate: issue, maturity, units: 1,
    });
    expect(flows.filter((f) => f.type === "coupon")).toHaveLength(4);
    expect(flows[0].dueDate.toISOString().slice(0, 10)).toBe("2026-04-15");
  });
});

describe("RF-05: precio derivado y YTM consistentes", () => {
  const bond = {
    faceValueCents: 100_000,
    couponBps: 420,
    frequency: "semiannual" as const,
    issueDate: issue,
    maturity: new Date(Date.UTC(2031, 0, 15)),
    asOf: issue,
  };

  it("mejor rating → mayor precio (menor tasa exigida)", () => {
    const pAAA = marketPriceCents({ ...bond, rating: "AAA" });
    const pB = marketPriceCents({ ...bond, rating: "B" });
    expect(pAAA).toBeGreaterThan(pB);
  });

  it("la YTM recupera aproximadamente la tasa exigida del rating", () => {
    const price = marketPriceCents({ ...bond, rating: "BBB" }); // 475 bps exigidos
    const ytm = ytmBps({ ...bond, priceCents: price });
    expect(Math.abs(ytm - 475)).toBeLessThanOrEqual(5);
  });
});
