import { PlacementCheckerClient } from "@/components/PlacementCheckerClient";

export const metadata = {
  title: "TikTok AI Label Check",
  description: "Check C2PA Content Credentials, AI signals, and TikTok AI-generated label steps.",
  alternates: { canonical: "/tools/tiktok-ai-label-check" },
};

export default function TikTokAiLabelCheckPage() {
  return <PlacementCheckerClient placementId="tiktok-ai" />;
}
