import { describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({
  default: () => ({ handlers: {}, auth: async () => null, signIn: async () => {}, signOut: async () => {} }),
}));
vi.mock("next-auth/providers/credentials", () => ({ default: () => ({}) }));
vi.mock("next-auth/providers/google", () => ({ default: () => ({}) }));

import { Reader } from "@contentauth/c2pa-node";
import { signImageWithC2pa } from "@/lib/c2pa-server";
import type { InspectionResult, ParsedManifestNode } from "@/lib/c2pa-inspect";
import { buildCredentialsCardModel } from "@/lib/credentials-card-model";
import { SITE_CONFIG } from "@/config/site";

const SAMPLE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

function makeNode(overrides: Partial<ParsedManifestNode> = {}): ParsedManifestNode {
  return {
    id: "m-1",
    label: "urn:uuid:test",
    title: "sample.png",
    format: "image/png",
    claimGenerator: "Test App 1.0",
    issuer: "Test Signer",
    signingTimeLocal: "Nov 19, 2026, 3:00 AM",
    actions: [],
    aiInfo: {
      isAiGeneratedOrModified: false,
      digitalSourceTypes: [],
      tools: [],
    },
    creditInfo: {
      socialAccounts: [],
      doNotTrain: false,
      hasTrainingMiningDeclaration: false,
    },
    exifDetails: {},
    captureDetails: {},
    hasCredentials: true,
    ingredients: [],
    ...overrides,
  };
}

function makeInspection(overrides: Partial<InspectionResult> = {}): InspectionResult {
  return {
    fileName: "photo.png",
    fileSize: 2048,
    mimeType: "image/png",
    sha256: "a".repeat(64),
    previewUrl: "blob:test",
    status: "verified",
    statusHeadline: "Content Credentials valid",
    statusDetail: "Signed by Test Signer.",
    validationErrors: [],
    rootNode: makeNode(),
    earlierManifests: [],
    cleanup: () => {},
    ...overrides,
  };
}

describe("CredentialsResultCard model", () => {
  it("renders valid known signer and never infers AI use from signer name", () => {
    const model = buildCredentialsCardModel(
      makeInspection({
        status: "verified",
        rootNode: makeNode({
          issuer: "OpenAI OpCo, LLC",
          actions: [{ action: "c2pa.published" }],
        }),
      })
    );

    expect(model.headerTitle).toBe("Here's what this file declares");
    expect(model.headerSubtitle).toBe(
      "Its credentials passed validation. Your file was not changed."
    );
    expect(model.badgeLabel).toBe("Valid");
    expect(model.rows.find((r) => r.id === "credentials")?.value).toBe(
      'Present, "Signed by OpenAI OpCo, LLC"'
    );
    const aiRow = model.rows.find((r) => r.id === "aiUse");
    expect(aiRow?.value).toBe("No AI use declared");
    expect(aiRow?.helper).toBe("This does not mean AI was not used.");
    // No AI training preference row when not declared
    expect(model.rows.find((r) => r.id === "trainingPreference")).toBeUndefined();
  });

  it("renders unrecognized signer and places certificate name in technical details as Not verified", () => {
    const model = buildCredentialsCardModel(
      makeInspection({
        status: "unrecognized",
        rootNode: makeNode({ issuer: "Self-Signed Studio" }),
      })
    );

    expect(model.headerTitle).toBe("This file is signed by an unrecognized source");
    expect(model.rows.find((r) => r.id === "credentials")?.value).toBe(
      'Present, "Unrecognized signer"'
    );
    expect(model.technicalDetails.unverifiedSignerName).toBe("Self-Signed Studio");
  });

  it("detects tampering with real C2PA fixture and labels declared values Unverified", async () => {
    const signed = await signImageWithC2pa({
      buffer: SAMPLE_PNG,
      mimeType: "image/png",
      fileName: "tamper-test.png",
      creatorName: "Test Creator",
      aiUse: "full_ai",
      modelType: "imageGeneration",
      modelName: "FixtureModel",
      doNotTrain: true,
    });

    const tampered = Buffer.from(signed.signedBuffer);
    tampered[tampered.length - 20] ^= 0xff;
    const reader = await Reader.fromAsset({ buffer: tampered, mimeType: "image/png" });
    expect(reader?.json()?.validation_state).toBe("Invalid");

    const model = buildCredentialsCardModel(
      makeInspection({
        status: "warning",
        validationErrors: ["asset hash mismatch"],
        rootNode: makeNode({
          issuer: "Test Signer",
          creditInfo: {
            socialAccounts: [],
            doNotTrain: true,
            hasTrainingMiningDeclaration: true,
            trainingPreferenceLabel: "Do not use for AI training (notAllowed)",
          },
        }),
      })
    );

    expect(model.headerTitle).toBe("This file's credentials have a problem");
    expect(model.rows.find((r) => r.id === "credentials")?.value).toBe(
      'Present, "Validation problem found"'
    );
    expect(model.rows.find((r) => r.id === "signedOn")?.unverified).toBe(true);
    expect(model.rows.find((r) => r.id === "madeWith")?.unverified).toBe(true);
    expect(model.rows.find((r) => r.id === "aiUse")?.unverified).toBe(true);
    expect(model.rows.find((r) => r.id === "trainingPreference")?.unverified).toBe(true);
    expect(model.technicalDetails.validationProblems[0]).toContain("modified");
  });

  it("renders no credentials state for unsigned fixture", async () => {
    const reader = await Reader.fromAsset({ buffer: SAMPLE_PNG, mimeType: "image/png" });
    expect(reader).toBeNull();

    const model = buildCredentialsCardModel(
      makeInspection({
        status: "none",
        rootNode: null,
      })
    );

    expect(model.headerTitle).toBe("No Content Credentials found");
    expect(model.headerSubtitle).toBe(
      "No declaration was found. This does not show how the file was made."
    );
    expect(model.rows.find((r) => r.id === "credentials")?.value).toBe("Not found");
    expect(model.rows.find((r) => r.id === "signedOn")?.value).toBe("Not available");
    expect(model.rows.find((r) => r.id === "madeWith")?.value).toBe("Not stated");
    expect(model.rows.find((r) => r.id === "aiUse")?.value).toBe("No AI use declared");
  });

  it("formats generated, edited, composite, and AI-labelled ingredient disclosures", () => {
    const generated = buildCredentialsCardModel(
      makeInspection({
        rootNode: makeNode({
          aiInfo: {
            isAiGeneratedOrModified: true,
            digitalSourceTypes: ["trainedAlgorithmicMedia"],
            tools: ["GenModel"],
            modelType: "imageGeneration",
            modelName: "GenModel",
          },
        }),
      })
    );
    expect(generated.rows.find((r) => r.id === "aiUse")?.value).toBe(
      "Yes, generated with AI"
    );
    expect(generated.rows.find((r) => r.id === "aiUse")?.disclosureDetail).toBe(
      "Model type: imageGeneration • Model: GenModel"
    );

    const edited = buildCredentialsCardModel(
      makeInspection({
        rootNode: makeNode({
          aiInfo: {
            isAiGeneratedOrModified: true,
            digitalSourceTypes: ["compositeWithTrainedAlgorithmicMedia"],
            tools: [],
          },
        }),
      })
    );
    expect(edited.rows.find((r) => r.id === "aiUse")?.value).toBe(
      "Yes, edited with AI"
    );

    const composite = buildCredentialsCardModel(
      makeInspection({
        rootNode: makeNode({
          aiInfo: {
            isAiGeneratedOrModified: true,
            digitalSourceTypes: ["compositeSynthetic"],
            tools: [],
          },
        }),
      })
    );
    expect(composite.rows.find((r) => r.id === "aiUse")?.value).toBe(
      "Yes, includes AI-generated elements"
    );

    const ingredientAi = buildCredentialsCardModel(
      makeInspection({
        rootNode: makeNode({
          ingredients: [
            makeNode({
              id: "ing-1",
              aiInfo: {
                isAiGeneratedOrModified: true,
                digitalSourceTypes: ["trainedAlgorithmicMedia"],
                tools: [],
              },
            }),
          ],
        }),
      })
    );
    expect(ingredientAi.rows.find((r) => r.id === "aiUse")?.value).toBe(
      "Yes, AI appears in the file's history"
    );
  });

  it("includes SynthID row from config, excludes GPS from copied summary, and avoids forbidden phrasing", () => {
    const model = buildCredentialsCardModel(
      makeInspection({
        rootNode: makeNode({
          captureDetails: {
            GPSLatitude: "25.2048 N",
            GPSLongitude: "55.2708 E",
          },
        }),
      })
    );

    const synthId = model.rows.find((r) => r.id === "synthId");
    expect(synthId?.value).toBe("Not checked here");
    expect(synthId?.helper).toBe(
      "SynthID is a separate watermark from Google. We do not detect or change it."
    );
    expect(synthId?.link?.href).toBe(SITE_CONFIG.synthIdHelpUrl);

    // GPS/capture details must not leak into copySummaryText
    expect(model.copySummaryText).not.toContain("25.2048");
    expect(model.copySummaryText).not.toContain("GPSLatitude");

    // Forbidden words check
    const allText = `${model.headerTitle} ${model.headerSubtitle} ${model.copySummaryText}`.toLowerCase();
    for (const forbidden of ["clean", "safe", "real", "human-made", "not ai", "passed ai check"]) {
      expect(allText).not.toContain(forbidden);
    }
  });
});
