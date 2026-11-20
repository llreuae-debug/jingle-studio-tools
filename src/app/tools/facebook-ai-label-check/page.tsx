import { PlacementCheckerClient } from "@/components/PlacementCheckerClient";

export const metadata = {
  title: "Facebook AI Label Check",
  description:
    "Inspect C2PA Content Credentials and Meta AI Info label readiness for Facebook posts and Reels locally in your browser.",
  alternates: { canonical: "/tools/facebook-ai-label-check" },
};

export default function FacebookAiLabelCheckPage() {
  return <PlacementCheckerClient placementId="facebook-ai" />;
}
