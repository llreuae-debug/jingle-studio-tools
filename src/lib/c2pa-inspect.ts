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
  hasCredentials: boolean;
  relationship?: string;
  ingredients: ParsedManifestNode[];
}

export interface InspectionResult {
  fileName: string;
  fileSize: number;
  mimeType: string;
  previewUrl: string;
  status: VerificationStatusKind;
  statusHeadline: string;
  statusDetail: string;
  validationErrors: string[];
  trustListSha256?: string;
  rootNode: ParsedManifestNode | null;
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
  const exifDetails: Record<string, string> = {};

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
      if (data.url) website = String(data.url);
    } else if (label === "c2pa.training-mining" && data) {
      const entries = data.entries || {};
      const values = Object.values(entries) as Array<{ use?: string }>;
      if (values.some((v) => v?.use === "notAllowed")) {
        doNotTrain = true;
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
    },
    exifDetails,
  };
}

export async function inspectBlob(
  blob: Blob,
  fileName: string
): Promise<InspectionResult> {
  const objectUrls: string[] = [];
  const previewUrl = URL.createObjectURL(blob);
  objectUrls.push(previewUrl);

  const cleanup = () => {
    for (const url of objectUrls) {
      URL.revokeObjectURL(url);
    }
  };

  const c2pa = await getC2pa();
  const trust = await getActiveTrustList();

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
      previewUrl,
      status: "none",
      statusHeadline: "No Content Credentials found",
      statusDetail:
        "This file does not contain C2PA Content Credentials. This does not mean the file is human-made or unedited—credentials may never have been attached, or may have been stripped by a platform.",
      validationErrors: [],
      trustListSha256: trust.sha256 || undefined,
      rootNode: null,
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
            creditInfo: { socialAccounts: [], doNotTrain: false },
            exifDetails: {},
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

    const hasUntrustedOnly =
      validationStatuses.length > 0 &&
      validationStatuses.every((s) =>
        (s.code || "").toLowerCase().includes("untrusted")
      );
    const hasHardErrors = validationErrors.length > 0 && !hasUntrustedOnly;

    let status: VerificationStatusKind = "verified";
    let statusHeadline = "Content Credentials valid";
    let statusDetail = rootNode?.issuer
      ? `Signed by ${rootNode.issuer}.`
      : "Cryptographic signature and manifest chain are intact.";

    if (hasHardErrors) {
      status = "warning";
      statusHeadline = "Validation warning";
      statusDetail =
        "The file or its Content Credentials failed one or more integrity checks.";
    } else if (hasUntrustedOnly || !rootNode?.issuer) {
      status = "unrecognized";
      statusHeadline = "Unrecognized signer";
      statusDetail =
        "The signature is intact, but the signing certificate is not on the C2PA trust list.";
    }

    return {
      fileName,
      fileSize: blob.size,
      mimeType: blob.type || "unknown",
      previewUrl,
      status,
      statusHeadline,
      statusDetail,
      validationErrors,
      trustListSha256: trust.sha256 || undefined,
      rootNode,
      cleanup,
    };
  } finally {
    await reader.free();
  }
}
