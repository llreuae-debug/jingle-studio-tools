import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { authenticateApiKey } from "@/lib/api-keys";
import { readC2paStoreFromBuffer, type AiUseChoice } from "@/lib/c2pa-server";
import { getWorkspaceBalance } from "@/lib/credits";
import { detectRealMimeType } from "@/lib/security";
import {
  createSignJobForWorkspace,
  getSignJobForWorkspace,
} from "@/lib/sign-jobs-service";

const MCP_TOOLS = [
  {
    name: "check_credentials",
    description:
      "Read C2PA Content Credentials from a base64-encoded file without storing it. Never strips or alters provenance.",
    inputSchema: {
      type: "object",
      properties: {
        base64: { type: "string", description: "Base64-encoded file bytes" },
        mimeType: { type: "string", description: "Optional MIME type hint" },
      },
      required: ["base64"],
    },
  },
  {
    name: "create_sign_job",
    description:
      "Create a C2PA signing job with honest AI disclosure answers. Preserves valid parent ingredients and blocks invalid/conflicting disclosures.",
    inputSchema: {
      type: "object",
      properties: {
        files: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              base64: { type: "string" },
            },
            required: ["name", "base64"],
          },
        },
        creatorName: { type: "string" },
        creatorWebsite: { type: "string" },
        aiUse: {
          type: "string",
          enum: [
            "full_ai",
            "original_edited_ai",
            "composite_ai",
            "human_edits_ai",
            "no_ai",
          ],
        },
        modelType: { type: "string" },
        modelName: { type: "string" },
        doNotTrain: { type: "boolean" },
        idempotencyKey: { type: "string" },
      },
      required: ["files", "creatorName", "aiUse"],
    },
  },
  {
    name: "get_sign_job",
    description: "Read signing job status, per-file results, and download URLs.",
    inputSchema: {
      type: "object",
      properties: {
        jobId: { type: "string" },
      },
      required: ["jobId"],
    },
  },
  {
    name: "get_credit_balance",
    description: "Read the current workspace credit balance.",
    inputSchema: { type: "object", properties: {} },
  },
];

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req.headers.get("authorization"));
  if (!auth.ok) {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: auth.error } },
      { status: auth.status }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || body.jsonrpc !== "2.0" || typeof body.method !== "string") {
    return NextResponse.json(
      { jsonrpc: "2.0", id: body?.id ?? null, error: { code: -32600, message: "Invalid JSON-RPC 2.0 request." } },
      { status: 400 }
    );
  }

  const { id = null, method, params = {} } = body;

  if (method === "initialize") {
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        serverInfo: { name: "jingle-studio-tools-mcp", version: "1.0.0" },
        capabilities: { tools: {} },
      },
    });
  }

  if (method === "tools/list") {
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      result: { tools: MCP_TOOLS },
    });
  }

  if (method === "tools/call") {
    const toolName = String(params?.name || "");
    const args = (params?.arguments || {}) as Record<string, unknown>;

    if (toolName === "get_credit_balance") {
      const balance = await getWorkspaceBalance(auth.workspaceId);
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: JSON.stringify({ workspaceId: auth.workspaceId, balance }) }],
        },
      });
    }

    if (toolName === "check_credentials") {
      const MAX_MCP_CHECK_BYTES = 25 * 1024 * 1024;
      const b64 = typeof args.base64 === "string" ? args.base64 : "";
      if (b64.length > Math.ceil(MAX_MCP_CHECK_BYTES * 1.4)) {
        return NextResponse.json({
          jsonrpc: "2.0",
          id,
          result: {
            isError: true,
            content: [{ type: "text", text: "File exceeds 25 MB maximum size limit." }],
          },
        });
      }
      const buf = Buffer.from(b64, "base64");
      const mimeType =
        detectRealMimeType(buf) ||
        (typeof args.mimeType === "string" ? args.mimeType : null);
      if (!buf.length || buf.length > MAX_MCP_CHECK_BYTES || !mimeType) {
        return NextResponse.json({
          jsonrpc: "2.0",
          id,
          result: {
            isError: true,
            content: [{ type: "text", text: "Invalid, oversized, or unsupported file bytes." }],
          },
        });
      }
      const result = await readC2paStoreFromBuffer(buf, mimeType);
      const payload = result
        ? {
            hasCredentials: true,
            validationState: result.store.validation_state,
            signer: result.activeManifest?.signature_info?.issuer || null,
            manifestStore: result.store,
          }
        : {
            hasCredentials: false,
            note: "No Content Credentials found. This does not show how the file was made.",
          };
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: { content: [{ type: "text", text: JSON.stringify(payload) }] },
      });
    }

    if (toolName === "create_sign_job") {
      const db = await getDb();
      const wsRows = await db
        .select({ ownerId: schema.workspaces.ownerId })
        .from(schema.workspaces)
        .where(eq(schema.workspaces.id, auth.workspaceId));

      if (wsRows.length === 0) {
        return NextResponse.json({
          jsonrpc: "2.0",
          id,
          result: {
            isError: true,
            content: [{ type: "text", text: JSON.stringify({ error: "Workspace not found." }) }],
          },
        });
      }

      const rawFiles = Array.isArray(args.files) ? args.files : [];
      const files = rawFiles
        .filter((f): f is { name: string; base64: string } =>
          Boolean(f && typeof f.name === "string" && typeof f.base64 === "string")
        )
        .map((f) => ({ name: f.name, buffer: Buffer.from(f.base64, "base64") }));

      const res = await createSignJobForWorkspace({
        workspaceId: auth.workspaceId,
        createdByUserId: wsRows[0].ownerId,
        files,
        creatorName: String(args.creatorName || ""),
        creatorWebsite: typeof args.creatorWebsite === "string" ? args.creatorWebsite : undefined,
        aiUse: String(args.aiUse || "") as AiUseChoice,
        modelType: typeof args.modelType === "string" ? args.modelType : undefined,
        modelName: typeof args.modelName === "string" ? args.modelName : undefined,
        doNotTrain: args.doNotTrain !== false,
        idempotencyKey: typeof args.idempotencyKey === "string" ? args.idempotencyKey : undefined,
      });

      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          isError: !res.ok,
          content: [{ type: "text", text: JSON.stringify(res) }],
        },
      });
    }

    if (toolName === "get_sign_job") {
      const jobId = String(args.jobId || "");
      const data = await getSignJobForWorkspace(auth.workspaceId, jobId);
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          isError: !data,
          content: [{ type: "text", text: JSON.stringify(data || { error: "Job not found" }) }],
        },
      });
    }

    return NextResponse.json(
      { jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown tool: ${toolName}` } },
      { status: 404 }
    );
  }

  return NextResponse.json(
    { jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown method: ${method}` } },
    { status: 404 }
  );
}
