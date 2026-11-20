import { PlacementCheckerClient } from "@/components/PlacementCheckerClient";

export const metadata = {
  title: "X (Twitter) AI Label Check",
  description:
    "Check C2PA Content Credentials, aspect ratio fit, and synthetic media disclosure best practices for X locally in your browser.",
  alternates: { canonical: "/tools/x-ai-label-check" },
};

export default function XAiLabelCheckPage() {
  return <PlacementCheckerClient placementId="x-ai" />;
}
