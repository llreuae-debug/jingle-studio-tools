import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Builder, LocalSigner, Reader } from "@contentauth/c2pa-node";

export type AiUseChoice =
  | "full_ai"
  | "original_edited_ai"
  | "composite_ai"
  | "human_edits_ai"
  | "no_ai";

export interface SignInputParams {
  buffer: Buffer;
  mimeType: "image/jpeg" | "image/png";
  fileName: string;
  creatorName: string;
  creatorWebsite?: string;
  aiUse: AiUseChoice;
  modelType?: string;
  modelName?: string;
  doNotTrain: boolean;
}

export interface SignOutputResult {
  signedBuffer: Buffer;
  outputSha256: string;
  isTestSignature: boolean;
  signerName: string;
  signingTimeIso: string;
  digitalSourceType: string;
  disclosureSummary: string;
  hadParentIngredient: boolean;
}

export class SigningError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const AI_DIGITAL_SOURCE_TYPES = new Set([
  "trainedAlgorithmicMedia",
  "compositeWithTrainedAlgorithmicMedia",
  "compositeSynthetic",
  "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia",
  "http://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmicMedia",
  "http://cv.iptc.org/newscodes/digitalsourcetype/compositeSynthetic",
]);

let cachedTestCert: { cert: Buffer; key: Buffer } | null = null;

async function getSigningCredentials(): Promise<{
  cert: Buffer;
  key: Buffer;
  isTestSignature: boolean;
}> {
  const mode = process.env.SIGNING_MODE || "test";

  if (mode === "production") {
    const certEnv = process.env.C2PA_CERT_PEM;
    const keyEnv = process.env.C2PA_KEY_PEM;
    if (!certEnv || !keyEnv) {
      throw new SigningError(
        "ERR_MISSING_PROD_CERT",
        "Production signing mode is active, but C2PA_CERT_PEM or C2PA_KEY_PEM is not configured."
      );
    }
    return {
      cert: Buffer.from(certEnv.replace(/\\n/g, "\n"), "utf8"),
      key: Buffer.from(keyEnv.replace(/\\n/g, "\n"), "utf8"),
      isTestSignature: false,
    };
  }

  if (process.env.C2PA_CERT_PEM && process.env.C2PA_KEY_PEM) {
    return {
      cert: Buffer.from(process.env.C2PA_CERT_PEM.replace(/\\n/g, "\n"), "utf8"),
      key: Buffer.from(process.env.C2PA_KEY_PEM.replace(/\\n/g, "\n"), "utf8"),
      isTestSignature: true,
    };
  }

  if (cachedTestCert) {
    return { ...cachedTestCert, isTestSignature: true };
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "c2pa-dev-cert-"));
  try {
    const caKeyPath = path.join(tmpDir, "ca-key.pem");
    const caCertPath = path.join(tmpDir, "ca-cert.pem");
    const caExtPath = path.join(tmpDir, "ca-ext.cnf");

    const keyPath = path.join(tmpDir, "key.pem");
    const csrPath = path.join(tmpDir, "leaf.csr");
    const certPath = path.join(tmpDir, "cert.pem");
    const leafExtPath = path.join(tmpDir, "leaf-ext.cnf");

    const { privateKey: caPrivateKey } = crypto.generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    await fs.writeFile(caKeyPath, caPrivateKey, "utf8");

    await fs.writeFile(
      caExtPath,
      [
        "[req]",
        "distinguished_name = req_dn",
        "x509_extensions = v3_ca",
        "prompt = no",
        "[req_dn]",
        "CN = Jingle Studio Dev Test CA",
        "O = Jingle Studio (Test)",
        "[v3_ca]",
        "basicConstraints = critical, CA:TRUE",
        "keyUsage = critical, keyCertSign, cRLSign",
        "subjectKeyIdentifier = hash",
      ].join("\n"),
      "utf8"
    );

    execFileSync("openssl", [
      "req",
      "-new",
      "-x509",
      "-sha256",
      "-key",
      caKeyPath,
      "-out",
      caCertPath,
      "-days",
      "365",
      "-config",
      caExtPath,
    ]);

    const { privateKey } = crypto.generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    await fs.writeFile(keyPath, privateKey, "utf8");

    await fs.writeFile(
      leafExtPath,
      [
        "[req]",
        "distinguished_name = req_dn",
        "prompt = no",
        "[req_dn]",
        "CN = Jingle Studio Dev Test Signer",
        "O = Jingle Studio (Test)",
        "[v3_leaf]",
        "basicConstraints = critical, CA:FALSE",
        "keyUsage = critical, digitalSignature",
        "extendedKeyUsage = emailProtection",
        "subjectKeyIdentifier = hash",
        "authorityKeyIdentifier = keyid,issuer",
      ].join("\n"),
      "utf8"
    );

    execFileSync("openssl", [
      "req",
      "-new",
      "-key",
      keyPath,
      "-out",
      csrPath,
      "-config",
      leafExtPath,
    ]);

    execFileSync("openssl", [
      "x509",
      "-req",
      "-sha256",
      "-in",
      csrPath,
      "-CA",
      caCertPath,
      "-CAkey",
      caKeyPath,
      "-CAcreateserial",
      "-out",
      certPath,
      "-days",
      "30",
      "-extfile",
      leafExtPath,
      "-extensions",
      "v3_leaf",
    ]);

    const [leafCert, caCert, key] = await Promise.all([
      fs.readFile(certPath),
      fs.readFile(caCertPath),
      fs.readFile(keyPath),
    ]);
    const cert = Buffer.concat([leafCert, Buffer.from("\n"), caCert]);
    cachedTestCert = { cert, key };
    return { cert, key, isTestSignature: true };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

export function isSigningTestMode(): boolean {
  return (process.env.SIGNING_MODE || "test") !== "production";
}

function mapDisclosure(aiUse: AiUseChoice): {
  digitalSourceType: string;
  actionName: string;
  requiresAiAssertion: boolean;
  summary: string;
} {
  switch (aiUse) {
    case "full_ai":
      return {
        digitalSourceType:
          "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia",
        actionName: "c2pa.created",
        requiresAiAssertion: true,
        summary: "Fully generated by AI (self-declared)",
      };
    case "original_edited_ai":
      return {
        digitalSourceType:
          "http://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmicMedia",
        actionName: "c2pa.edited",
        requiresAiAssertion: true,
        summary: "Original work edited or enhanced with AI (self-declared)",
      };
    case "composite_ai":
      return {
        digitalSourceType:
          "http://cv.iptc.org/newscodes/digitalsourcetype/compositeSynthetic",
        actionName: "c2pa.edited",
        requiresAiAssertion: true,
        summary: "Composite with at least one AI element (self-declared)",
      };
    case "human_edits_ai":
      return {
        digitalSourceType:
          "http://cv.iptc.org/newscodes/digitalsourcetype/humanEdits",
        actionName: "c2pa.edited",
        requiresAiAssertion: false,
        summary: "Human edits to an AI-generated asset (self-declared)",
      };
    case "no_ai":
      return {
        digitalSourceType:
          "http://cv.iptc.org/newscodes/digitalsourcetype/humanEdits",
        actionName: "c2pa.edited",
        requiresAiAssertion: false,
        summary: "Made by people, no generative AI (self-declared)",
      };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hasAiSignalInManifestStore(store: any): boolean {
  const manifests = store?.manifests || {};
  for (const manifest of Object.values(manifests) as Array<Record<string, unknown>>) {
    const assertions = Array.isArray(manifest?.assertions) ? manifest.assertions : [];
    for (const assertion of assertions as Array<{ label?: string; data?: Record<string, unknown> }>) {
      const label = assertion?.label || "";
      if (label === "c2pa.ai-disclosure") return true;
      if (label.startsWith("c2pa.actions")) {
        const actions = Array.isArray(assertion?.data?.actions)
          ? assertion.data.actions
          : [];
        for (const act of actions as Array<{ digitalSourceType?: string }>) {
          if (act?.digitalSourceType && AI_DIGITAL_SOURCE_TYPES.has(act.digitalSourceType)) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getHardValidationErrors(store: any): string[] {
  const statuses: Array<{ code?: string; explanation?: string }> = Array.isArray(
    store?.validation_status
  )
    ? store.validation_status
    : [];

  return statuses
    .filter((s) => {
      const code = (s.code || "").toLowerCase();
      // Allow untrusted-signer status when reading test-signed parent ingredients,
      // but block any integrity, hash, claim, or signature failures.
      if (code === "signingcredential.untrusted") return false;
      return (
        code.includes("mismatch") ||
        code.includes("invalid") ||
        code.includes("missing") ||
        code.includes("error") ||
        code.includes("revoked") ||
        code.includes("expired") ||
        code.includes("inaccessible")
      );
    })
    .map((s) => s.explanation || s.code || "Validation failure");
}

export async function signImageWithC2pa(params: SignInputParams): Promise<SignOutputResult> {
  const mapping = mapDisclosure(params.aiUse);

  if (mapping.requiresAiAssertion && !params.modelType?.trim()) {
    throw new SigningError(
      "ERR_MODEL_TYPE_REQUIRED",
      "modelType is required when generative AI use is declared."
    );
  }

  // 1. Inspect existing credentials (G2, G3, G4)
  const existingReader = await Reader.fromAsset({
    buffer: params.buffer,
    mimeType: params.mimeType,
  });

  let hadParentIngredient = false;
  if (existingReader) {
    const store = existingReader.json();
    const hardErrors = getHardValidationErrors(store);
    if (hardErrors.length > 0 || store.validation_state === "Invalid") {
      throw new SigningError(
        "ERR_INVALID_EXISTING_CREDENTIALS",
        `Existing Content Credentials failed validation: ${hardErrors.join("; ") || "Invalid manifest"}`
      );
    }

    if (params.aiUse === "no_ai" && hasAiSignalInManifestStore(store)) {
      throw new SigningError(
        "ERR_DISCLOSURE_CONFLICT",
        "Cannot declare 'no generative AI' when an existing ingredient is labelled as AI-generated or AI-modified."
      );
    }

    hadParentIngredient = true;
  }

  // 2. Build new manifest
  const signingTimeIso = new Date().toISOString();
  const builder = await Builder.withJsonAsync({
    title: params.fileName,
    format: params.mimeType,
    claim_generator_info: [
      {
        name: "Jingle Studio Tools",
        version: "1.0.0",
      },
    ],
    assertions: [
      {
        label: "stds.schema-org.CreativeWork",
        data: {
          "@context": "https://schema.org",
          "@type": "CreativeWork",
          author: [
            {
              "@type": "Person",
              name: `${params.creatorName.trim()} (Self-declared)`,
            },
          ],
          ...(params.creatorWebsite?.trim()
            ? { url: params.creatorWebsite.trim() }
            : {}),
        },
      },
      ...(params.doNotTrain
        ? [
            {
              label: "c2pa.training-mining",
              data: {
                entries: {
                  "c2pa.ai_generative_training": { use: "notAllowed" },
                  "c2pa.ai_inference": { use: "notAllowed" },
                  "c2pa.data_mining": { use: "notAllowed" },
                },
              },
            },
          ]
        : []),
    ],
  });

  if (existingReader) {
    const parentLabel = "parent-ingredient";
    await builder.addIngredient(
      JSON.stringify({
        title: params.fileName,
        label: parentLabel,
        relationship: "parentOf",
      }),
      { buffer: params.buffer, mimeType: params.mimeType }
    );
    builder.addAction(
      JSON.stringify({
        action: "c2pa.opened",
        when: signingTimeIso,
        softwareAgent: { name: "Jingle Studio Tools", version: "1.0.0" },
        parameters: {
          ingredientIds: [parentLabel],
        },
      })
    );
  } else if (mapping.actionName !== "c2pa.created") {
    builder.addAction(
      JSON.stringify({
        action: "c2pa.created",
        when: signingTimeIso,
        softwareAgent: { name: "Jingle Studio Tools", version: "1.0.0" },
        digitalSourceType: mapping.digitalSourceType,
      })
    );
  }

  const actionPayload: Record<string, unknown> = {
    action: mapping.actionName,
    when: signingTimeIso,
    softwareAgent: { name: "Jingle Studio Tools", version: "1.0.0" },
    digitalSourceType: mapping.digitalSourceType,
  };

  if (mapping.requiresAiAssertion) {
    builder.addAssertion("c2pa.ai-disclosure", {
      modelType: params.modelType!.trim(),
      ...(params.modelName?.trim() ? { modelName: params.modelName.trim() } : {}),
      declaredBy: "self-declared",
    });
  }

  builder.addAction(JSON.stringify(actionPayload));

  // 3. Sign
  const { cert, key, isTestSignature } = await getSigningCredentials();
  const tsaUrl = process.env.C2PA_TSA_URL || undefined;
  const signer = LocalSigner.newSigner(cert, key, "es256", tsaUrl);

  const output: { buffer: Buffer | null } = { buffer: null };
  builder.sign(
    signer,
    { buffer: params.buffer, mimeType: params.mimeType },
    output
  );
  const signedBuffer = output.buffer;
  if (!signedBuffer) {
    throw new SigningError(
      "ERR_SIGNING_FAILED",
      "Signer did not produce a signed output buffer."
    );
  }

  // 4. Post-sign validation (failed files are never delivered)
  const verifyReader = await Reader.fromAsset({
    buffer: signedBuffer,
    mimeType: params.mimeType,
  });

  if (!verifyReader) {
    throw new SigningError(
      "ERR_POST_SIGN_VALIDATION_FAILED",
      "Signed file could not be read back for post-sign validation."
    );
  }

  const verifyStore = verifyReader.json();
  const postErrors = getHardValidationErrors(verifyStore);
  if (postErrors.length > 0 || verifyStore.validation_state === "Invalid") {
    throw new SigningError(
      "ERR_POST_SIGN_VALIDATION_FAILED",
      `Post-sign validation failed: ${postErrors.join("; ") || "Invalid manifest"}`
    );
  }

  const outputSha256 = crypto.createHash("sha256").update(signedBuffer).digest("hex");
  const activeManifest = verifyReader.getActive();
  const signerName =
    activeManifest?.signature_info?.issuer ||
    (isTestSignature ? "Jingle Studio Dev Test Signer" : "Jingle Studio");

  return {
    signedBuffer,
    outputSha256,
    isTestSignature,
    signerName,
    signingTimeIso,
    digitalSourceType: mapping.digitalSourceType,
    disclosureSummary: mapping.summary,
    hadParentIngredient,
  };
}
