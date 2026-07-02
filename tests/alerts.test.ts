import { describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import { buildRatingChangeAlerts } from "@/lib/alerts";
import type { Bond, Issuer, Position } from "@/lib/types";

const now = new Date(Date.UTC(2026, 6, 1));
const issuerId = new ObjectId();
const bondId = new ObjectId();
const investorId = new ObjectId();

const issuer: Issuer = { _id: issuerId, name: "NubeTech", sector: "tecnologia", rating: "BB" };
const bond: Bond = {
  _id: bondId,
  name: "NubeTech 2031",
  issuerId,
  faceValueCents: 100_000,
  couponType: "fixed",
  couponBps: 500,
  frequency: "annual",
  issueDate: new Date(Date.UTC(2025, 6, 1)),
  maturity: new Date(Date.UTC(2031, 6, 1)),
  term: "medio",
  status: "allocated",
  totalUnits: 1000,
  finalPriceCents: 98_000,
  createdAt: now,
};
const position: Position = { bondId, investorId, units: 10, costCents: 980_000, createdAt: now };

describe("RF-07: alertas por cambio de rating", () => {
  it("genera alertas de rating, precio y rebalanceo al empeorar a high yield", () => {
    const alerts = buildRatingChangeAlerts({
      issuer, oldRating: "BBB", newRating: "BB",
      bonds: [bond], positions: [position], now,
    });
    const types = alerts.map((a) => a.type).sort();
    expect(types).toEqual(["price", "rating", "rebalance"]);
    expect(alerts.every((a) => a.investorId.equals(investorId))).toBe(true);
  });

  it("al mejorar el rating no hay alerta de rebalanceo", () => {
    const alerts = buildRatingChangeAlerts({
      issuer, oldRating: "BB", newRating: "A",
      bonds: [bond], positions: [position], now,
    });
    expect(alerts.map((a) => a.type)).not.toContain("rebalance");
    expect(alerts.map((a) => a.type)).toContain("rating");
  });

  it("sin posiciones no se genera ninguna alerta", () => {
    const alerts = buildRatingChangeAlerts({
      issuer, oldRating: "BBB", newRating: "CCC",
      bonds: [bond], positions: [], now,
    });
    expect(alerts).toHaveLength(0);
  });
});
