import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Jingle Studio Tools — Content Credentials & Honest AI Disclosure";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "64px",
          background: "#0A192F",
          color: "#FFFFFF",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: "#3985FF",
            marginBottom: 16,
          }}
        >
          JINGLE STUDIO TOOLS
        </div>
        <div style={{ fontSize: 54, fontWeight: 700, lineHeight: 1.15, maxWidth: 920 }}>
          Verify Content Credentials and sign honest AI disclosures.
        </div>
        <div style={{ fontSize: 24, color: "#E4E9F2", marginTop: 24, maxWidth: 820 }}>
          Free in-browser C2PA verification for Instagram, TikTok, and web media, plus batch signing.
        </div>
      </div>
    ),
    { ...size }
  );
}
