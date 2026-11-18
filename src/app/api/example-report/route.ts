import { NextResponse } from "next/server";
import { Reader } from "@contentauth/c2pa-node";
import { signImageWithC2pa } from "@/lib/c2pa-server";

const SAMPLE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

let cachedReport: Record<string, unknown> | null = null;

export async function GET() {
  if (cachedReport) {
    return NextResponse.json(cachedReport);
  }

  const signed = await signImageWithC2pa({
    buffer: SAMPLE_PNG,
    mimeType: "image/png",
    fileName: "example-file.png",
    creatorName: "Jingle Studio Example",
    aiUse: "original_edited_ai",
    modelType: "imageEditing",
    modelName: "Example AI Editor",
    doNotTrain: true,
  });

  const reader = await Reader.fromAsset({
    buffer: signed.signedBuffer,
    mimeType: "image/png",
  });
  const store = reader?.json();
  const active = reader?.getActive();

  cachedReport = {
    label: "Example file",
    credentialsStatus: signed.isTestSignature
      ? "Signed (Test signer — unrecognized in external apps)"
      : "Valid",
    signer: signed.signerName,
    signedOn: signed.signingTimeIso,
    appOrDevice: "Jingle Studio Tools 1.0.0",
    actions: "c2pa.edited (compositeWithTrainedAlgorithmicMedia)",
    ingredients: signed.hadParentIngredient ? "1 parent ingredient" : "None (root asset)",
    aiInformation: "Original work edited with AI • imageEditing (Example AI Editor) [Self-declared]",
    validationState: store?.validation_state || "Valid",
    manifestTitle: active?.title || "example-file.png",
  };

  return NextResponse.json(cachedReport);
}
