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

export interface SubscriptionPlanSpec {
  id: "free" | "pro" | "business";
  name: string;
  monthlyPriceCents: number;
  dailyLimit: number;
  maxImageMb: number;
  maxVideoMb: number;
  includedCredits: number;
  features: string[];
  active: boolean;
}

export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlanSpec[] = [
  {
    id: "free",
    name: "Free",
    monthlyPriceCents: 0,
    dailyLimit: 20,
    maxImageMb: 25,
    maxVideoMb: 100,
    includedCredits: 10,
    features: [
      "Basic metadata & C2PA inspection",
      "Lossless personal metadata cleaning",
      "Up to 25 MB images & 100 MB videos",
      "20 daily checks/cleanings",
    ],
    active: true,
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPriceCents: 1900,
    dailyLimit: 250,
    maxImageMb: 50,
    maxVideoMb: 250,
    includedCredits: 100,
    features: [
      "Extended metadata & provenance reports",
      "7-day processing history & clean downloads",
      "Up to 50 MB images & 250 MB videos",
      "250 daily checks/cleanings & priority batch signing",
    ],
    active: true,
  },
  {
    id: "business",
    name: "Business",
    monthlyPriceCents: 4900,
    dailyLimit: 2000,
    maxImageMb: 100,
    maxVideoMb: 500,
    includedCredits: 500,
    features: [
      "REST API & MCP server access",
      "Team workspaces & shared roles",
      "Up to 100 MB images & 500 MB videos",
      "2,000 daily checks/cleanings",
    ],
    active: true,
  },
];

export function getCreditCostPerFile(): number {
  const parsed = Number.parseInt(process.env.CREDIT_COST_PER_FILE || "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}
