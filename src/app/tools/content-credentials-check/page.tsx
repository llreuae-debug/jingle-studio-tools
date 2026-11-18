import { PlacementCheckerClient } from "@/components/PlacementCheckerClient";

export const metadata = {
  title: "Content Credentials Check",
  description: "Inspect C2PA Content Credentials, signer trust, and ingredient history locally.",
};

export default function ContentCredentialsCheckPage() {
  return <PlacementCheckerClient placementId="content-credentials" />;
}
