import { describe, expect, it } from "vitest";
import { allocateOrders } from "@/lib/allocation";

describe("RF-02: adjudicación del bookbuilding", () => {
  const orders = [
    { id: "a", priceCents: 99_500, units: 100 },
    { id: "b", priceCents: 99_000, units: 200 },
    { id: "c", priceCents: 98_000, units: 150 },
  ];

  it("solo participan las órdenes con precio >= precio final", () => {
    const r = allocateOrders(orders, 99_000, 1000);
    expect(r.allocations.map((a) => a.id).sort()).toEqual(["a", "b"]);
    expect(r.rejectedIds).toEqual(["c"]);
  });

  it("sin sobredemanda se adjudica todo lo pedido", () => {
    const r = allocateOrders(orders, 98_000, 1000);
    expect(r.unitsAllocated).toBe(450);
    expect(r.rejectedIds).toHaveLength(0);
  });

  it("con sobredemanda hay prorrateo proporcional sin sobre-asignar", () => {
    const r = allocateOrders(orders, 99_000, 150); // demanda elegible: 300
    expect(r.unitsAllocated).toBeLessThanOrEqual(150);
    const a = Object.fromEntries(r.allocations.map((x) => [x.id, x.units]));
    expect(a["a"]).toBe(50); // 100 × 0.5
    expect(a["b"]).toBe(100); // 200 × 0.5
  });

  it("órdenes cuyo prorrateo cae a 0 títulos quedan rechazadas", () => {
    const r = allocateOrders(
      [
        { id: "grande", priceCents: 100_000, units: 10_000 },
        { id: "mini", priceCents: 100_000, units: 1 },
      ],
      100_000,
      100
    );
    expect(r.rejectedIds).toContain("mini");
    expect(r.unitsAllocated).toBeLessThanOrEqual(100);
  });
});
