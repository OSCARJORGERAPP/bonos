import type { ObjectId } from "mongodb";

// Convenciones del dominio (PROMPT.md §3):
// - importes en CÉNTIMOS (enteros)
// - tasas/cupones en PUNTOS BÁSICOS (enteros; 100 bps = 1%)

export type Role = "admin" | "investor";

export type Rating = "AAA" | "AA" | "A" | "BBB" | "BB" | "B" | "CCC";

export type Sector =
  | "energia"
  | "financiero"
  | "industrial"
  | "tecnologia"
  | "consumo"
  | "salud"
  | "telecomunicaciones";

export type CouponType = "fixed" | "variable";
export type PaymentFrequency = "annual" | "semiannual" | "quarterly";
export type Term = "corto" | "medio" | "largo"; // ≤3a / 3-7a / >7a
export type BondStatus = "offering" | "allocated" | "matured";
export type OrderStatus = "pending" | "allocated" | "rejected";
export type PaymentType = "coupon" | "principal";
export type PaymentStatus = "scheduled" | "paid";
export type AlertType = "rating" | "price" | "rebalance";

export interface User {
  _id?: ObjectId;
  email: string;
  role: Role;
  createdAt: Date;
}

export interface Issuer {
  _id?: ObjectId;
  name: string;
  sector: Sector;
  rating: Rating;
}

export interface Bond {
  _id?: ObjectId;
  name: string;
  issuerId: ObjectId;
  faceValueCents: number; // valor nominal por título, en céntimos
  couponType: CouponType;
  couponBps: number; // fijo: tasa; variable: spread sobre la referencia
  frequency: PaymentFrequency;
  issueDate: Date;
  maturity: Date;
  term: Term;
  status: BondStatus;
  totalUnits: number; // títulos ofertados
  finalPriceCents?: number; // precio fijado al cerrar el bookbuilding
  createdAt: Date;
}

export interface Order {
  _id?: ObjectId;
  bondId: ObjectId;
  investorId: ObjectId;
  priceCents: number; // precio ofrecido por título
  units: number;
  status: OrderStatus;
  allocatedUnits?: number; // tras prorrateo
  createdAt: Date;
}

export interface Position {
  _id?: ObjectId;
  bondId: ObjectId;
  investorId: ObjectId;
  units: number;
  costCents: number; // coste total de adquisición
  createdAt: Date;
}

export interface Payment {
  _id?: ObjectId;
  bondId: ObjectId;
  investorId: ObjectId;
  dueDate: Date;
  type: PaymentType;
  amountCents: number;
  status: PaymentStatus;
}

export interface Alert {
  _id?: ObjectId;
  investorId: ObjectId;
  type: AlertType;
  message: string;
  bondId?: ObjectId;
  issuerId?: ObjectId;
  sent: boolean;
  createdAt: Date;
}

export interface ReferenceRate {
  _id?: ObjectId;
  name: string; // p. ej. "EURIBOR-SIM"
  bps: number; // valor vigente en puntos básicos
  updatedAt: Date;
}

export interface BondDocument {
  _id?: ObjectId;
  bondId: ObjectId;
  kind: "fiscal" | "uso-fondos" | "covenants" | "reporte";
  filename: string;
  s3Key: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: Date;
}
