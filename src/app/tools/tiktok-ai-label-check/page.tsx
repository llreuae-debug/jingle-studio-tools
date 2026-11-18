import { PlacementCheckerClient } from "@/components/PlacementCheckerClient";

export const metadata = {
  title: "TikTok AI Label Check",
  description: "Check C2PA Content Credentials, AI signals, and TikTok AI-generated label steps.",
};

export default function TikTokAiLabelCheckPage() {
  return <PlacementCheckerClient placementId="tiktok-ai" />;
}
