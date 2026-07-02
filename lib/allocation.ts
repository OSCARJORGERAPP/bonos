// Lógica pura de adjudicación del bookbuilding (RF-02):
// participan las órdenes con precio >= precio final; si la demanda supera
// los títulos ofertados, prorrateo proporcional (floor, sin sobre-asignar).

export interface BookOrder<TId = unknown> {
  id: TId;
  priceCents: number;
  units: number;
}

export interface AllocationResult<TId = unknown> {
  allocations: Array<{ id: TId; units: number }>;
  rejectedIds: TId[];
  unitsAllocated: number;
}

export function allocateOrders<TId>(
  orders: BookOrder<TId>[],
  finalPriceCents: number,
  totalUnits: number
): AllocationResult<TId> {
  const eligible = orders.filter((o) => o.priceCents >= finalPriceCents);
  const rejected = orders.filter((o) => o.priceCents < finalPriceCents);

  const demanded = eligible.reduce((sum, o) => sum + o.units, 0);
  const ratio = demanded > totalUnits ? totalUnits / demanded : 1;

  const allocations = eligible
    .map((o) => ({ id: o.id, units: Math.floor(o.units * ratio) }))
    .filter((a) => a.units > 0);

  const allocatedIdSet = new Set(allocations.map((a) => a.id));
  const rejectedIds = [
    ...rejected.map((o) => o.id),
    ...eligible.filter((o) => !allocatedIdSet.has(o.id)).map((o) => o.id),
  ];

  return {
    allocations,
    rejectedIds,
    unitsAllocated: allocations.reduce((s, a) => s + a.units, 0),
  };
}
