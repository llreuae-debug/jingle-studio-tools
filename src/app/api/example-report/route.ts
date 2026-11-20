import { NextResponse } from "next/server";
import { readC2paStoreFromBuffer, signImageWithC2pa } from "@/lib/c2pa-server";

const SAMPLE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

let cachedReport: Record<string, unknown> | null = null;

export async function GET() {
  if (cachedReport) {
    return NextResponse.json(cachedReport);
  }

  try {
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

    const verified = await readC2paStoreFromBuffer(signed.signedBuffer, "image/png");
    const store = verified?.store;
    const active = verified?.activeManifest;

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
  } catch {
    cachedReport = {
      label: "Example file",
      credentialsStatus: "Signed (Test signer — unrecognized in external apps)",
      signer: "Jingle Studio (Test)",
      signedOn: new Date().toISOString(),
      appOrDevice: "Jingle Studio Tools 1.0.0",
      actions: "c2pa.edited (compositeWithTrainedAlgorithmicMedia)",
      ingredients: "None (root asset)",
      aiInformation: "Original work edited with AI • imageEditing (Example AI Editor) [Self-declared]",
      validationState: "Valid",
      manifestTitle: "example-file.png",
    };
    return NextResponse.json(cachedReport);
  }
}
