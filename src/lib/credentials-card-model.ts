import { SITE_CONFIG } from "@/config/site";
import type {
  InspectionResult,
  ParsedAction,
  ParsedManifestNode,
  VerificationStatusKind,
} from "./c2pa-inspect";

export interface CardActionItem {
  label: string;
  detail?: string;
}

export interface CardIngredientItem {
  id: string;
  title: string;
  format?: string;
  thumbnailUrl?: string;
  credentialStatus: string;
  hasAiHistory: boolean;
}

export interface CardRowModel {
  id:
    | "credentials"
    | "signedOn"
    | "madeWith"
    | "aiUse"
    | "editHistory"
    | "sourceFiles"
    | "trainingPreference"
    | "synthId";
  label: string;
  value: string;
  unverified?: boolean;
  helper?: string;
  disclosureDetail?: string;
  link?: { label: string; href: string };
  expandableActions?: CardActionItem[];
  expandableIngredients?: CardIngredientItem[];
}

export interface CredentialsCardModel {
  status: VerificationStatusKind;
  headerTitle: string;
  headerSubtitle: string;
  badgeLabel: string;
  fileName: string;
  mimeType: string;
  fileSizeLabel: string;
  previewUrl: string;
  rows: CardRowModel[];
  technicalDetails: {
    sha256: string;
    unverifiedSignerName?: string;
    validationProblems: string[];
    earlierManifests: Array<{
      id: string;
      title: string;
      issuer?: string;
      signingTimeLocal?: string;
      claimGenerator?: string;
    }>;
    exifDetails: Record<string, string>;
    captureDetails: Record<string, string>;
  };
  copySummaryText: string;
  ariaAnnouncement: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function hasAiInDescendants(node: ParsedManifestNode): boolean {
  for (const ing of node.ingredients) {
    if (ing.aiInfo.isAiGeneratedOrModified || hasAiInDescendants(ing)) {
      return true;
    }
  }
  return false;
}

function describeAction(act: ParsedAction): CardActionItem {
  const cleanName = act.action.replace(/^c2pa\./, "");
  const parts: string[] = [];
  if (act.softwareAgent) parts.push(act.softwareAgent);
  if (act.digitalSourceType) parts.push(act.digitalSourceType);
  if (act.when) parts.push(act.when);
  return {
    label: cleanName.charAt(0).toUpperCase() + cleanName.slice(1),
    detail: parts.length > 0 ? parts.join(" • ") : undefined,
  };
}

function formatProblemPlain(err: string): string {
  const lower = err.toLowerCase();
  if (lower.includes("hash") || lower.includes("mismatch")) {
    return "The file contents no longer match the signed hash (the file may have been modified or re-encoded).";
  }
  if (lower.includes("signature") || lower.includes("invalid")) {
    return "The cryptographic signature could not be verified.";
  }
  if (lower.includes("missing")) {
    return "Required credential data is missing or incomplete.";
  }
  return err;
}

function buildAiUseValue(root: ParsedManifestNode | null): {
  value: string;
  helper?: string;
  disclosureDetail?: string;
} {
  if (!root) {
    return {
      value: "No AI use declared",
      helper: "This does not mean AI was not used.",
    };
  }

  const dsts = root.aiInfo.digitalSourceTypes;
  const hasGenerated = dsts.includes("trainedAlgorithmicMedia");
  const hasEdited = dsts.includes("compositeWithTrainedAlgorithmicMedia");
  const hasComposite = dsts.includes("compositeSynthetic");
  const hasIngredientAi = hasAiInDescendants(root);

  const { modelType, modelName } = root.aiInfo;
  const disclosureParts: string[] = [];
  if (modelType) disclosureParts.push(`Model type: ${modelType}`);
  if (modelName) disclosureParts.push(`Model: ${modelName}`);
  const disclosureDetail =
    disclosureParts.length > 0 ? disclosureParts.join(" • ") : undefined;

  if (hasGenerated) {
    return { value: "Yes, generated with AI", disclosureDetail };
  }
  if (hasEdited) {
    return { value: "Yes, edited with AI", disclosureDetail };
  }
  if (hasComposite) {
    return { value: "Yes, includes AI-generated elements", disclosureDetail };
  }
  if (hasIngredientAi) {
    return { value: "Yes, AI appears in the file's history", disclosureDetail };
  }
  if (disclosureDetail) {
    return { value: "Yes, AI use declared", disclosureDetail };
  }

  return {
    value: "No AI use declared",
    helper: "This does not mean AI was not used.",
  };
}

export function buildCredentialsCardModel(result: InspectionResult): CredentialsCardModel {
  const root = result.rootNode;
  const isWarning = result.status === "warning";
  const isUnrecognized = result.status === "unrecognized";
  const isValid = result.status === "verified";

  const headerMap: Record<
    VerificationStatusKind,
    { title: string; subtitle: string; badge: string }
  > = {
    verified: {
      title: "Here's what this file declares",
      subtitle: "Its credentials passed validation. Your file was not changed.",
      badge: "Valid",
    },
    unrecognized: {
      title: "This file is signed by an unrecognized source",
      subtitle:
        "The signature could not be matched to the trust list. Your file was not changed.",
      badge: "Unrecognized",
    },
    warning: {
      title: "This file's credentials have a problem",
      subtitle:
        "The file or its record may have changed after signing. Your file was not changed.",
      badge: "Warning",
    },
    none: {
      title: "No Content Credentials found",
      subtitle: "No declaration was found. This does not show how the file was made.",
      badge: "No credentials",
    },
  };

  const header = headerMap[result.status];

  let credentialsRowValue = "Not found";
  if (isValid) {
    credentialsRowValue = root?.issuer
      ? `Present, "Signed by ${root.issuer}"`
      : "Present";
  } else if (isUnrecognized) {
    credentialsRowValue = 'Present, "Unrecognized signer"';
  } else if (isWarning) {
    credentialsRowValue = 'Present, "Validation problem found"';
  }

  const signedOnValue = root?.signingTimeLocal || "Not available";
  const madeWithValue = root?.claimGenerator || "Not stated";
  const aiUse = buildAiUseValue(root);

  const actions = root?.actions || [];
  const editHistoryValue =
    actions.length === 0
      ? "None recorded"
      : `${actions.length} recorded ${actions.length === 1 ? "action" : "actions"}`;

  const ingredients = root?.ingredients || [];
  const sourceFilesValue =
    ingredients.length === 0
      ? "None"
      : `${ingredients.length} ${ingredients.length === 1 ? "ingredient" : "ingredients"}`;

  const rows: CardRowModel[] = [
    {
      id: "credentials",
      label: "Content Credentials",
      value: credentialsRowValue,
    },
    {
      id: "signedOn",
      label: "Signed on",
      value: signedOnValue,
      unverified: isWarning && Boolean(root?.signingTimeLocal),
    },
    {
      id: "madeWith",
      label: "Made with",
      value: madeWithValue,
      unverified: isWarning && Boolean(root?.claimGenerator),
    },
    {
      id: "aiUse",
      label: "AI use declared",
      value: aiUse.value,
      helper: aiUse.helper,
      disclosureDetail: aiUse.disclosureDetail,
      unverified: isWarning && Boolean(root),
    },
    {
      id: "editHistory",
      label: "Edit history",
      value: editHistoryValue,
      unverified: isWarning && actions.length > 0,
      expandableActions: actions.map(describeAction),
    },
    {
      id: "sourceFiles",
      label: "Source files",
      value: sourceFilesValue,
      unverified: isWarning && ingredients.length > 0,
      expandableIngredients: ingredients.map((ing) => ({
        id: ing.id,
        title: ing.title,
        format: ing.format,
        thumbnailUrl: ing.thumbnailUrl,
        credentialStatus: ing.hasCredentials
          ? ing.issuer
            ? `Signed (${ing.issuer})`
            : "Credentials present"
          : "No credentials",
        hasAiHistory: ing.aiInfo.isAiGeneratedOrModified || hasAiInDescendants(ing),
      })),
    },
  ];

  if (root?.creditInfo.hasTrainingMiningDeclaration && root.creditInfo.trainingPreferenceLabel) {
    rows.push({
      id: "trainingPreference",
      label: "AI training preference",
      value: root.creditInfo.trainingPreferenceLabel,
      unverified: isWarning,
    });
  }

  rows.push({
    id: "synthId",
    label: "SynthID",
    value: "Not checked here",
    helper: "SynthID is a separate watermark from Google. We do not detect or change it.",
    link: {
      label: "How to check in Gemini",
      href: SITE_CONFIG.synthIdHelpUrl,
    },
  });

  const validationProblems = isWarning
    ? Array.from(
        new Set(
          (result.validationErrors.length > 0
            ? result.validationErrors
            : ["Validation check failed for this file or manifest."]
          ).map(formatProblemPlain)
        )
      )
    : [];

  const unverifiedSignerName =
    (isUnrecognized || isWarning) && root?.issuer ? root.issuer : undefined;

  const summaryLines = [
    `${result.fileName} (${result.mimeType || "file"}, ${formatBytes(result.fileSize)})`,
    `Status: ${header.badge} — ${header.title}`,
    ...rows.map((r) => `${r.label}: ${r.value}${r.unverified ? " (Unverified)" : ""}`),
    `SHA-256: ${result.sha256}`,
  ];

  return {
    status: result.status,
    headerTitle: header.title,
    headerSubtitle: header.subtitle,
    badgeLabel: header.badge,
    fileName: result.fileName,
    mimeType: result.mimeType || "unknown",
    fileSizeLabel: formatBytes(result.fileSize),
    previewUrl: result.previewUrl,
    rows,
    technicalDetails: {
      sha256: result.sha256,
      unverifiedSignerName,
      validationProblems,
      earlierManifests: result.earlierManifests.map((m) => ({
        id: m.id,
        title: m.title,
        issuer: m.issuer,
        signingTimeLocal: m.signingTimeLocal,
        claimGenerator: m.claimGenerator,
      })),
      exifDetails: root?.exifDetails || {},
      captureDetails: root?.captureDetails || {},
    },
    copySummaryText: summaryLines.join("\n"),
    ariaAnnouncement: `${result.fileName}: ${header.badge}. ${header.title}.`,
  };
}
