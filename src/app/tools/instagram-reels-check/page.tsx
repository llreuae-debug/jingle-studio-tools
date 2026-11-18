import { PlacementCheckerClient } from "@/components/PlacementCheckerClient";

export const metadata = {
  title: "Instagram Reels Check",
  description: "Check video C2PA Content Credentials and Instagram Reels format fit locally.",
};

export default function InstagramReelsCheckPage() {
  return <PlacementCheckerClient placementId="instagram-reels" />;
}
