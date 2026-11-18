import crypto from "node:crypto";
import type { CreditPack } from "@/config/pricing";

export interface CheckoutSessionResult {
  provider: "hosted" | "manual_bank";
  providerRef: string;
  checkoutUrl?: string;
  bankInstructions?: {
    bankName: string;
    accountTitle: string;
    ibanOrAccount: string;
    referenceCode: string;
    amountDisplay: string;
  };
}

export interface PaymentProvider {
  createCheckout(params: {
    workspaceId: string;
    pack: CreditPack;
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutSessionResult>;
}

export class HostedCheckoutProvider implements PaymentProvider {
  async createCheckout(params: {
    workspaceId: string;
    pack: CreditPack;
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutSessionResult> {
    const providerRef = `hosted_${crypto.randomUUID()}`;
    const baseCheckout =
      process.env.HOSTED_CHECKOUT_URL ||
      `${params.successUrl}?providerRef=${encodeURIComponent(providerRef)}&status=pending`;

    return {
      provider: "hosted",
      providerRef,
      checkoutUrl: baseCheckout,
    };
  }
}

export class ManualBankTransferProvider implements PaymentProvider {
  async createCheckout(params: {
    workspaceId: string;
    pack: CreditPack;
  }): Promise<CheckoutSessionResult> {
    const shortCode = crypto.randomBytes(4).toString("hex").toUpperCase();
    const providerRef = `bank_${shortCode}_${Date.now()}`;

    return {
      provider: "manual_bank",
      providerRef,
      bankInstructions: {
        bankName: process.env.BANK_NAME || "Jingle Studio Operations Bank",
        accountTitle: process.env.BANK_ACCOUNT_TITLE || "Jingle Studio",
        ibanOrAccount: process.env.BANK_ACCOUNT_NUMBER || "Configure BANK_ACCOUNT_NUMBER in .env",
        referenceCode: providerRef,
        amountDisplay: `$${(params.pack.amountCents / 100).toFixed(2)} ${params.pack.currency}`,
      },
    };
  }
}

export function getPaymentProvider(mode?: "hosted" | "manual_bank"): PaymentProvider {
  const configured = mode || (process.env.BILLING_PROVIDER === "hosted" ? "hosted" : "manual_bank");
  return configured === "hosted"
    ? new HostedCheckoutProvider()
    : new ManualBankTransferProvider();
}

export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  const cleanSig = signatureHeader.replace(/^sha256=/, "");
  if (cleanSig.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(cleanSig), Buffer.from(expected));
}
