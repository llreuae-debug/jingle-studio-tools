import { SITE_CONFIG } from "@/config/site";

export function renderTransactionalEmailHtml(params: {
  heading: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): string {
  const logoUrl = `${SITE_CONFIG.siteUrl}/brand/logo-email.png`;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>${params.heading}</title></head>
<body style="margin:0;padding:24px;background:#F6FBDD;color:#3F113D;font-family:Inter,Arial,sans-serif;">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:20px;border:1px solid #DDEEC2;padding:28px;">
    <tr>
      <td style="padding-bottom:20px;">
        <img src="${logoUrl}" alt="${SITE_CONFIG.name}" width="200" style="display:block;height:auto;border:0;" />
      </td>
    </tr>
    <tr>
      <td>
        <h1 style="margin:0 0 12px;font-size:20px;color:#3F113D;">${params.heading}</h1>
        <div style="font-size:14px;line-height:1.6;color:#3F113D;">${params.bodyHtml}</div>
        ${
          params.ctaLabel && params.ctaUrl
            ? `<p style="margin-top:24px;"><a href="${params.ctaUrl}" style="display:inline-block;padding:12px 22px;background:#3F113D;color:#F6FBDD;text-decoration:none;border-radius:999px;font-weight:600;font-size:13px;">${params.ctaLabel}</a></p>`
            : ""
        }
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderReceiptHtml(params: {
  invoiceId: string;
  workspaceName: string;
  credits: number;
  amountDisplay: string;
  dateIso: string;
}): string {
  return renderTransactionalEmailHtml({
    heading: `Receipt #${params.invoiceId}`,
    bodyHtml: `
      <p>Workspace: <strong>${params.workspaceName}</strong></p>
      <p>Credits added: <strong>${params.credits}</strong></p>
      <p>Amount: <strong>${params.amountDisplay}</strong></p>
      <p>Date: ${params.dateIso}</p>
    `,
    ctaLabel: "Open Billing",
    ctaUrl: `${SITE_CONFIG.siteUrl}/app/billing`,
  });
}
