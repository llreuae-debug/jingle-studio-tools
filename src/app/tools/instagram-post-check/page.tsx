import { PlacementCheckerClient } from "@/components/PlacementCheckerClient";

export const metadata = {
  title: "Instagram Post Check",
  description: "Check C2PA Content Credentials and Instagram feed format fit locally in your browser.",
  alternates: { canonical: "/tools/instagram-post-check" },
};

export default function InstagramPostCheckPage() {
  return <PlacementCheckerClient placementId="instagram-post" />;
}
