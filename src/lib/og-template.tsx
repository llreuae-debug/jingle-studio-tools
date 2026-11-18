import { ImageResponse } from "next/og";

export function renderBrandOgImage(params: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px",
          background: "#3F113D",
          color: "#F6FBDD",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              width: "68px",
              height: "68px",
              borderRadius: "16px",
              background: "#B9D175",
              color: "#3F113D",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "42px",
              fontWeight: 700,
            }}
          >
            j
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "24px", fontWeight: 700, color: "#F6FBDD" }}>
              Jingle Studio Tools
            </span>
            <span style={{ fontSize: "16px", fontWeight: 600, color: "#B9D175" }}>
              {params.eyebrow}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "1020px" }}>
          <div style={{ fontSize: "52px", fontWeight: 700, lineHeight: 1.12, color: "#F6FBDD" }}>
            {params.title}
          </div>
          <div style={{ fontSize: "24px", color: "#DDEEC2", lineHeight: 1.35 }}>
            {params.subtitle}
          </div>
        </div>

        <div style={{ fontSize: "18px", color: "#B9D175", fontWeight: 600 }}>
          C2PA Content Credentials • Honest AI Disclosure
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
