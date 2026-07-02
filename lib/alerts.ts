// Generación pura de alertas ante un cambio de rating (RF-07):
// - "rating" siempre, por posición afectada
// - "price" si el bono está adjudicado (precio derivado del modelo)
// - "rebalance" si el rating empeora a high yield (BB o peor)
import { marketPriceCents } from "./finance";
import type { Alert, Bond, Issuer, Position, Rating } from "./types";

const RATING_ORDER: Rating[] = ["AAA", "AA", "A", "BBB", "BB", "B", "CCC"];

export function buildRatingChangeAlerts(params: {
  issuer: Issuer;
  oldRating: Rating;
  newRating: Rating;
  bonds: Bond[];
  positions: Position[];
  now: Date;
}): Alert[] {
  const { issuer, oldRating, newRating, bonds, positions, now } = params;
  const worsened = RATING_ORDER.indexOf(newRating) > RATING_ORDER.indexOf(oldRating);
  const alerts: Alert[] = [];

  for (const pos of positions) {
    const bond = bonds.find((b) => b._id!.equals(pos.bondId));
    if (!bond) continue;

    alerts.push({
      investorId: pos.investorId,
      type: "rating",
      issuerId: issuer._id,
      bondId: bond._id,
      message: `El rating de ${issuer.name} cambió de ${oldRating} a ${newRating}.`,
      sent: false,
      createdAt: now,
    });

    if (bond.status === "allocated") {
      const oldPrice = marketPriceCents({ ...bond, rating: oldRating, asOf: now });
      const newPrice = marketPriceCents({ ...bond, rating: newRating, asOf: now });
      alerts.push({
        investorId: pos.investorId,
        type: "price",
        issuerId: issuer._id,
        bondId: bond._id,
        message: `Precio estimado de ${bond.name}: ${(oldPrice / 100).toFixed(2)}€ → ${(newPrice / 100).toFixed(2)}€ por el cambio de rating.`,
        sent: false,
        createdAt: now,
      });
    }

    if (worsened && ["BB", "B", "CCC"].includes(newRating)) {
      alerts.push({
        investorId: pos.investorId,
        type: "rebalance",
        issuerId: issuer._id,
        bondId: bond._id,
        message: `${issuer.name} bajó a ${newRating} (high yield): considera rebalancear tu exposición en ${bond.name}.`,
        sent: false,
        createdAt: now,
      });
    }
  }
  return alerts;
}
