import { PlacementCheckerClient } from "@/components/PlacementCheckerClient";

export const metadata = {
  title: "Instagram Story Check",
  description: "Check C2PA Content Credentials and Instagram Story 9:16 format fit locally.",
};

export default function InstagramStoryCheckPage() {
  return <PlacementCheckerClient placementId="instagram-story" />;
}
