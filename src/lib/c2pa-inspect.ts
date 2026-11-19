import { createC2pa, Reader, type C2pa } from "@contentauth/c2pa-web/inline";

export type VerificationStatusKind =
  | "verified"
  | "unrecognized"
  | "warning"
  | "none";

export interface ParsedAction {
  action: string;
  when?: string;
  softwareAgent?: string;
  digitalSourceType?: string;
}

export interface ParsedAiInfo {
  isAiGeneratedOrModified: boolean;
  digitalSourceTypes: string[];
  tools: string[];
  modelName?: string;
  modelType?: string;
}

export interface ParsedCreditInfo {
  author?: string;
  website?: string;
  socialAccounts: string[];
  doNotTrain: boolean;
  hasTrainingMiningDeclaration: boolean;
  trainingPreferenceLabel?: string;
}

export interface ParsedManifestNode {
  id: string;
  label: string;
  title: string;
  format?: string;
  thumbnailUrl?: string;
  claimGenerator?: string;
  issuer?: string;
  signingTimeLocal?: string;
  signingTimeIso?: string;
  actions: ParsedAction[];
  aiInfo: ParsedAiInfo;
  creditInfo: ParsedCreditInfo;
  exifDetails: Record<string, string>;
  captureDetails: Record<string, string>;
  hasCredentials: boolean;
  relationship?: string;
  ingredients: ParsedManifestNode[];
}

export interface InspectionResult {
  fileName: string;
  fileSize: number;
  mimeType: string;
  sha256: string;
  previewUrl: string;
  status: VerificationStatusKind;
  statusHeadline: string;
  statusDetail: string;
  validationErrors: string[];
  trustListSha256?: string;
  rootNode: ParsedManifestNode | null;
  earlierManifests: ParsedManifestNode[];
  cleanup: () => void;
}

let c2paPromise: Promise<C2pa> | null = null;

async function getC2pa(): Promise<C2pa> {
  if (!c2paPromise) {
    c2paPromise = createC2pa();
  }
  return c2paPromise;
}

interface TrustListResponse {
  pem: string | null;
  sha256: string | null;
}

let trustCache: TrustListResponse | null = null;

async function getActiveTrustList(): Promise<TrustListResponse> {
  if (trustCache) return trustCache;
  try {
    const res = await fetch("/api/trust-list/active");
    if (res.ok) {
      const data = (await res.json()) as TrustListResponse;
      trustCache = data;
      return data;
    }
  } catch {
    // Best-effort: fallback to default SDK trust behavior
  }
  return { pem: null, sha256: null };
}

function formatLocalTime(iso?: string): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

const AI_DIGITAL_SOURCE_TYPES = new Set([
  "trainedAlgorithmicMedia",
  "compositeWithTrainedAlgorithmicMedia",
  "compositeSynthetic",
  "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia",
  "http://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmicMedia",
  "http://cv.iptc.org/newscodes/digitalsourcetype/compositeSynthetic",
]);

function shortDigitalSourceType(dst?: string): string | undefined {
  if (!dst) return undefined;
  const parts = dst.split("/");
  return parts[parts.length - 1] || dst;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractManifestDetails(manifest: any): Omit<
  ParsedManifestNode,
  "id" | "label" | "thumbnailUrl" | "ingredients" | "hasCredentials" | "relationship"
> {
  const title: string = manifest?.title || "Untitled asset";
  const format: string | undefined = manifest?.format;

  let claimGenerator: string | undefined = manifest?.claim_generator;
  if (!claimGenerator && Array.isArray(manifest?.claim_generator_info) && manifest.claim_generator_info[0]) {
    const info = manifest.claim_generator_info[0];
    claimGenerator = [info.name, info.version].filter(Boolean).join(" ");
  }

  const issuer: string | undefined = manifest?.signature_info?.issuer;
  const signingTimeIso: string | undefined = manifest?.signature_info?.time;
  const signingTimeLocal = formatLocalTime(signingTimeIso);

  const actions: ParsedAction[] = [];
  const digitalSourceTypes: string[] = [];
  const tools = new Set<string>();
  let modelName: string | undefined;
  let modelType: string | undefined;
  let author: string | undefined;
  let website: string | undefined;
  const socialAccounts: string[] = [];
  let doNotTrain = false;
  let hasTrainingMiningDeclaration = false;
  let trainingPreferenceLabel: string | undefined;
  const exifDetails: Record<string, string> = {};
  const captureDetails: Record<string, string> = {};

  const assertions = Array.isArray(manifest?.assertions) ? manifest.assertions : [];

  for (const assertion of assertions) {
    const label: string = assertion?.label || "";
    const data = assertion?.data;

    if (label.startsWith("c2pa.actions")) {
      const actionList = Array.isArray(data?.actions) ? data.actions : [];
      for (const act of actionList) {
        const dst = shortDigitalSourceType(act?.digitalSourceType);
        const agent =
          typeof act?.softwareAgent === "string"
            ? act.softwareAgent
            : act?.softwareAgent?.name;

        actions.push({
          action: act?.action || "unknown",
          when: act?.when ? formatLocalTime(act.when) : undefined,
          softwareAgent: agent,
          digitalSourceType: dst,
        });

        if (dst && AI_DIGITAL_SOURCE_TYPES.has(act?.digitalSourceType || dst)) {
          digitalSourceTypes.push(dst);
          if (agent) tools.add(agent);
        }
      }
    } else if (label === "c2pa.ai-disclosure" && data) {
      if (data.modelName) modelName = String(data.modelName);
      if (data.modelType) modelType = String(data.modelType);
      if (data.modelName) tools.add(String(data.modelName));
    } else if (label === "stds.schema-org.CreativeWork" && data) {
      if (Array.isArray(data.author)) {
        const firstAuthor = data.author[0];
        if (typeof firstAuthor === "string") author = firstAuthor;
        else if (firstAuthor?.name) author = String(firstAuthor.name);
        for (const a of data.author) {
          if (a?.sameAs) {
            if (Array.isArray(a.sameAs)) {
              socialAccounts.push(...a.sameAs.map(String));
            } else {
              socialAccounts.push(String(a.sameAs));
            }
          }
        }
      }
      if (data.url) {
        try {
          const parsed = new URL(String(data.url));
          if (parsed.protocol === "http:" || parsed.protocol === "https:") {
            website = parsed.toString();
          }
        } catch {
          // ignore malformed or unsafe URLs
        }
      }
    } else if (label === "c2pa.training-mining" && data) {
      hasTrainingMiningDeclaration = true;
      const entries = data.entries || {};
      const values = Object.values(entries) as Array<{ use?: string }>;
      if (values.some((v) => v?.use === "notAllowed")) {
        doNotTrain = true;
        trainingPreferenceLabel = "Do not use for AI training (notAllowed)";
      } else if (values.some((v) => v?.use === "constrained")) {
        trainingPreferenceLabel = "Constrained AI training";
      } else if (values.some((v) => v?.use === "allowed")) {
        trainingPreferenceLabel = "AI training allowed";
      } else {
        trainingPreferenceLabel = "Declared";
      }
    } else if ((label === "stds.exif" || label === "exif") && data && typeof data === "object") {
      const interestingKeys = [
        "exif:Make",
        "exif:Model",
        "exif:LensModel",
        "exif:FocalLength",
        "exif:FNumber",
        "exif:ExposureTime",
        "exif:ISOSpeedRatings",
      ];
      for (const key of interestingKeys) {
        if (data[key] !== undefined && data[key] !== null) {
          exifDetails[key.replace("exif:", "")] = String(data[key]);
        }
      }
      for (const [key, val] of Object.entries(data)) {
        if (val === undefined || val === null) continue;
        if (/gps|location|lat|lon|altitude|datetimeoriginal|createdate/i.test(key)) {
          captureDetails[key.replace(/^exif:/i, "")] = String(val);
        }
      }
    }
  }

  const isAiGeneratedOrModified =
    digitalSourceTypes.length > 0 || Boolean(modelName || modelType);

  return {
    title,
    format,
    claimGenerator,
    issuer,
    signingTimeLocal,
    signingTimeIso,
    actions,
    aiInfo: {
      isAiGeneratedOrModified,
      digitalSourceTypes: Array.from(new Set(digitalSourceTypes)),
      tools: Array.from(tools),
      modelName,
      modelType,
    },
    creditInfo: {
      author,
      website,
      socialAccounts: Array.from(new Set(socialAccounts)),
      doNotTrain,
      hasTrainingMiningDeclaration,
      trainingPreferenceLabel,
    },
    exifDetails,
    captureDetails,
  };
}

async function computeSha256Hex(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function inspectBlob(
  blob: Blob,
  fileName: string,
  onStage?: (stage: "reading" | "checking") => void
): Promise<InspectionResult> {
  onStage?.("reading");
  const objectUrls: string[] = [];
  const previewUrl = URL.createObjectURL(blob);
  objectUrls.push(previewUrl);

  const cleanup = () => {
    for (const url of objectUrls) {
      URL.revokeObjectURL(url);
    }
  };

  const [sha256, c2pa, trust] = await Promise.all([
    computeSha256Hex(blob),
    getC2pa(),
    getActiveTrustList(),
  ]);

  onStage?.("checking");
  const reader = await Reader.fromBlob(
    c2pa,
    blob.type || undefined,
    blob
  );

  if (!reader) {
    return {
      fileName,
      fileSize: blob.size,
      mimeType: blob.type || "unknown",
      sha256,
      previewUrl,
      status: "none",
      statusHeadline: "No Content Credentials found",
      statusDetail:
        "No declaration was found. This does not show how the file was made.",
      validationErrors: [],
      trustListSha256: trust.sha256 || undefined,
      rootNode: null,
      earlierManifests: [],
      cleanup,
    };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = (await reader.manifestStore()) as any;
    const activeLabel: string | null = store?.active_manifest || null;
    const manifests: Record<string, unknown> = store?.manifests || {};
    const validationStatuses: Array<{ code?: string; explanation?: string }> =
      Array.isArray(store?.validation_status) ? store.validation_status : [];

    const validationErrors = validationStatuses
      .filter((s) => {
        const code = (s.code || "").toLowerCase();
        return (
          code.includes("mismatch") ||
          code.includes("invalid") ||
          code.includes("missing") ||
          code.includes("error") ||
          code.includes("untrusted")
        );
      })
      .map((s) => s.explanation || s.code || "Validation issue");

    async function resolveThumbnail(identifier?: string): Promise<string | undefined> {
      if (!identifier) return undefined;
      try {
        const bytes = await reader!.resourceToBytes(identifier);
        const thumbBlob = new Blob([bytes]);
        const url = URL.createObjectURL(thumbBlob);
        objectUrls.push(url);
        return url;
      } catch {
        return undefined;
      }
    }

    let nodeCounter = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async function buildNode(manifestLabel: string, relationship?: string): Promise<ParsedManifestNode | null> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const manifest = manifests[manifestLabel] as any;
      if (!manifest) return null;

      const details = extractManifestDetails(manifest);
      const thumbnailUrl = await resolveThumbnail(manifest?.thumbnail?.identifier);
      const rawIngredients = Array.isArray(manifest?.ingredients)
        ? manifest.ingredients
        : [];

      const ingredients: ParsedManifestNode[] = [];
      for (const ing of rawIngredients) {
        if (ing?.active_manifest && manifests[ing.active_manifest]) {
          const child = await buildNode(ing.active_manifest, ing.relationship);
          if (child) ingredients.push(child);
        } else {
          const ingThumb = await resolveThumbnail(ing?.thumbnail?.identifier);
          ingredients.push({
            id: `ing-${++nodeCounter}`,
            label: `no-manifest-${nodeCounter}`,
            title: ing?.title || "Source file",
            format: ing?.format,
            thumbnailUrl: ingThumb,
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
            hasCredentials: false,
            relationship: ing?.relationship,
            ingredients: [],
          });
        }
      }

      return {
        id: `manifest-${++nodeCounter}`,
        label: manifestLabel,
        thumbnailUrl,
        hasCredentials: true,
        relationship,
        ingredients,
        ...details,
      };
    }

    const rootNode = activeLabel ? await buildNode(activeLabel) : null;

    const earlierManifests: ParsedManifestNode[] = [];
    for (const label of Object.keys(manifests)) {
      if (label === activeLabel) continue;
      const node = await buildNode(label);
      if (node) earlierManifests.push(node);
    }

    const validationStateInvalid =
      String(store?.validation_state || "").toLowerCase() === "invalid";
    const hasUntrustedOnly =
      !validationStateInvalid &&
      validationStatuses.length > 0 &&
      validationStatuses.every((s) =>
        (s.code || "").toLowerCase().includes("untrusted")
      );
    const hasHardErrors =
      validationStateInvalid || (validationErrors.length > 0 && !hasUntrustedOnly);

    let status: VerificationStatusKind = "verified";
    let statusHeadline = "Content Credentials valid";
    let statusDetail = rootNode?.issuer
      ? `Signed by ${rootNode.issuer}.`
      : "Cryptographic signature and manifest chain are intact.";

    if (hasHardErrors) {
      status = "warning";
      statusHeadline = "Validation warning";
      statusDetail =
        "The file or its record may have changed after signing. Your file was not changed.";
    } else if (hasUntrustedOnly || !rootNode?.issuer) {
      status = "unrecognized";
      statusHeadline = "Unrecognized signer";
      statusDetail =
        "The signature could not be matched to the trust list. Your file was not changed.";
    }

    return {
      fileName,
      fileSize: blob.size,
      mimeType: blob.type || "unknown",
      sha256,
      previewUrl,
      status,
      statusHeadline,
      statusDetail,
      validationErrors,
      trustListSha256: trust.sha256 || undefined,
      rootNode,
      earlierManifests,
      cleanup,
    };
  } finally {
    await reader.free();
  }
}
