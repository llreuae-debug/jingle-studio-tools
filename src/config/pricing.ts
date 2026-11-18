export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  amountCents: number;
  currency: string;
  description: string;
}

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "starter-25",
    name: "Starter Pack",
    credits: 25,
    amountCents: 900,
    currency: "USD",
    description: "25 signed files with C2PA provenance and public proof pages.",
  },
  {
    id: "agency-100",
    name: "Agency Pack",
    credits: 100,
    amountCents: 2900,
    currency: "USD",
    description: "100 signed files for teams, agencies, and batch campaigns.",
  },
  {
    id: "studio-500",
    name: "Studio Pack",
    credits: 500,
    amountCents: 9900,
    currency: "USD",
    description: "500 signed files with priority batch throughput.",
  },
];

export function getCreditCostPerFile(): number {
  const parsed = Number.parseInt(process.env.CREDIT_COST_PER_FILE || "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}
