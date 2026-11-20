import { PlacementCheckerClient } from "@/components/PlacementCheckerClient";

export const metadata = {
  title: "YouTube AI Label Check",
  description:
    "Verify C2PA Content Credentials, video format fit, and YouTube Studio altered or synthetic content disclosure steps.",
  alternates: { canonical: "/tools/youtube-ai-label-check" },
};

export default function YouTubeAiLabelCheckPage() {
  return <PlacementCheckerClient placementId="youtube-ai" />;
}
