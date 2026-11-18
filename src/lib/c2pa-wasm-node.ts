import crypto from "node:crypto";
import { Worker as NodeWorker } from "node:worker_threads";

function cborUint(major: number, n: number): Buffer {
  const m = major << 5;
  if (n < 24) return Buffer.from([m | n]);
  if (n < 256) return Buffer.from([m | 24, n]);
  if (n < 65536) {
    const b = Buffer.alloc(3);
    b[0] = m | 25;
    b.writeUInt16BE(n, 1);
    return b;
  }
  const b = Buffer.alloc(5);
  b[0] = m | 26;
  b.writeUInt32BE(n, 1);
  return b;
}

function cborInt(n: number): Buffer {
  return n >= 0 ? cborUint(0, n) : cborUint(1, -1 - n);
}

function cborBytes(buf: Uint8Array | Buffer): Buffer {
  const b = Buffer.from(buf);
  return Buffer.concat([cborUint(2, b.length), b]);
}

function cborText(str: string): Buffer {
  const b = Buffer.from(str, "utf8");
  return Buffer.concat([cborUint(3, b.length), b]);
}

function cborArray(items: Buffer[]): Buffer {
  return Buffer.concat([cborUint(4, items.length), ...items]);
}

function cborMap(entries: Array<[Buffer, Buffer]>): Buffer {
  return Buffer.concat([
    cborUint(5, entries.length),
    ...entries.flatMap(([k, v]) => [k, v]),
  ]);
}

function pemToDers(pem: string): Buffer[] {
  const matches = [
    ...pem.matchAll(/-----BEGIN CERTIFICATE-----([\s\S]+?)-----END CERTIFICATE-----/g),
  ];
  return matches.map((m) => Buffer.from(m[1].replace(/\s+/g, ""), "base64"));
}

export function buildCoseSign1(
  claimBytes: Uint8Array,
  certPem: string,
  keyPem: string,
  reserveSize?: number
): Uint8Array<ArrayBuffer> {
  const ders = pemToDers(certPem);
  const x5chain =
    ders.length === 1 ? cborBytes(ders[0]) : cborArray(ders.map(cborBytes));

  const protectedBytes = cborMap([
    [cborInt(1), cborInt(-7)], // alg: ES256
    [cborInt(33), x5chain], // x5chain
  ]);

  const sigStructure = cborArray([
    cborText("Signature1"),
    cborBytes(protectedBytes),
    cborBytes(Buffer.alloc(0)),
    cborBytes(claimBytes),
  ]);

  const sig = crypto.sign("SHA256", sigStructure, {
    key: keyPem,
    dsaEncoding: "ieee-p1363",
  });

  const coseTag = Buffer.from([0xd2]); // CBOR Tag 18 (COSE_Sign1)
  const buildEnvelope = (unprotected: Buffer) =>
    Buffer.concat([
      coseTag,
      cborArray([
        cborBytes(protectedBytes),
        unprotected,
        Buffer.from([0xf6]), // null detached payload
        cborBytes(sig),
      ]),
    ]);

  let out = buildEnvelope(cborMap([]));
  if (reserveSize && reserveSize > out.length + 16) {
    // Pad unprotected header with { "pad": bstr(...) } so total COSE_Sign1 length matches reserveSize
    const padKey = cborText("pad");
    const dummyPad = cborMap([[padKey, cborBytes(Buffer.alloc(256))]]);
    const overhead = buildEnvelope(dummyPad).length - out.length - 256;
    const padBytes = reserveSize - out.length - overhead;
    if (padBytes > 0) {
      out = buildEnvelope(cborMap([[padKey, cborBytes(Buffer.alloc(padBytes))]]));
    }
  }

  return new Uint8Array(out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength));
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return (
    v !== null &&
    typeof v === "object" &&
    Object.getPrototypeOf(v) === Object.prototype
  );
}

const shimBlobMap = new Map<string, Blob>();
let workerShimInstalled = false;

function installNodeWorkerShim() {
  if (workerShimInstalled || typeof globalThis.Worker !== "undefined") {
    workerShimInstalled = true;
    return;
  }
  workerShimInstalled = true;

  if (typeof globalThis.self === "undefined") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).self = globalThis;
  }

  const origCreate = globalThis.URL?.createObjectURL;
  const origRevoke = globalThis.URL?.revokeObjectURL;

  if (globalThis.URL) {
    globalThis.URL.createObjectURL = (obj: Blob | MediaSource) => {
      if (obj instanceof Blob) {
        const id = `blob:node-shim-${crypto.randomUUID()}`;
        shimBlobMap.set(id, obj);
        return id;
      }
      return origCreate ? origCreate(obj) : "";
    };
    globalThis.URL.revokeObjectURL = (url: string) => {
      if (shimBlobMap.has(url)) {
        shimBlobMap.delete(url);
        return;
      }
      origRevoke?.(url);
    };
  }

  async function encodeBlobs(val: unknown): Promise<unknown> {
    if (val instanceof Blob) {
      const ab = await val.arrayBuffer();
      return { __shimBlob: true, type: val.type, buf: new Uint8Array(ab) };
    }
    if (Array.isArray(val)) return Promise.all(val.map(encodeBlobs));
    if (isPlainObject(val)) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val)) {
        out[k] = await encodeBlobs(v);
      }
      return out;
    }
    return val;
  }

  class NodeWebWorkerShim {
    private _listeners = new Map<string, Set<(ev: unknown) => void>>();
    private _queue: Array<{ data: unknown; transfer?: Transferable[] }> = [];
    private _w: NodeWorker | null = null;
    onmessage: ((ev: unknown) => void) | null = null;
    onerror: ((ev: unknown) => void) | null = null;

    constructor(url: string | URL) {
      const urlStr = String(url);
      void this._init(urlStr);
    }

    private async _init(urlStr: string) {
      let code = "";
      if (urlStr.startsWith("blob:node-shim-")) {
        const b = shimBlobMap.get(urlStr);
        code = b ? await b.text() : "";
      } else if (urlStr.startsWith("data:")) {
        const comma = urlStr.indexOf(",");
        code = decodeURIComponent(urlStr.slice(comma + 1));
      }

      const preamble = `
        const { parentPort } = require("node:worker_threads");
        const listeners = new Map();
        const OrigBlob = globalThis.Blob;
        class SyncBlob extends OrigBlob {
          constructor(parts = [], opts = {}) {
            super(parts, opts);
            this._syncParts = parts;
          }
          _getSyncUint8() {
            const chunks = this._syncParts.map((p) => {
              if (p instanceof Uint8Array) return p;
              if (p instanceof ArrayBuffer) return new Uint8Array(p);
              if (ArrayBuffer.isView(p)) return new Uint8Array(p.buffer, p.byteOffset, p.byteLength);
              if (typeof p === "string") return Buffer.from(p, "utf8");
              if (p && p._getSyncUint8) return p._getSyncUint8();
              return Buffer.alloc(0);
            });
            return Buffer.concat(chunks);
          }
        }
        globalThis.Blob = SyncBlob;
        globalThis.FileReaderSync = class FileReaderSync {
          readAsArrayBuffer(blob) {
            const u8 = blob && blob._getSyncUint8 ? blob._getSyncUint8() : Buffer.alloc(0);
            return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
          }
        };
        function isPlain(v) {
          return v !== null && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype;
        }
        function decodeBlobs(val) {
          if (val && typeof val === "object" && val.__shimBlob) {
            return new SyncBlob([val.buf], { type: val.type });
          }
          if (Array.isArray(val)) return val.map(decodeBlobs);
          if (isPlain(val)) {
            const out = {};
            for (const [k, v] of Object.entries(val)) out[k] = decodeBlobs(v);
            return out;
          }
          return val;
        }
        globalThis.self = globalThis;
        globalThis.addEventListener = (type, fn) => {
          if (!listeners.has(type)) listeners.set(type, new Set());
          listeners.get(type).add(fn);
        };
        globalThis.removeEventListener = (type, fn) => {
          listeners.get(type)?.delete(fn);
        };
        globalThis.postMessage = (data, transfer) => parentPort.postMessage(data, transfer);
        parentPort.on("message", (data) => {
          const ev = { data: decodeBlobs(data) };
          if (typeof globalThis.onmessage === "function") globalThis.onmessage(ev);
          for (const fn of listeners.get("message") || []) fn(ev);
        });
      `;

      const worker = new NodeWorker(preamble + "\n" + code, { eval: true });
      worker.unref();
      worker.on("message", (data) => {
        const ev = { data };
        if (typeof this.onmessage === "function") this.onmessage(ev);
        for (const fn of this._listeners.get("message") || []) fn(ev);
      });
      worker.on("error", (err) => {
        const ev = { error: err, message: err.message };
        if (typeof this.onerror === "function") this.onerror(ev);
        for (const fn of this._listeners.get("error") || []) fn(ev);
      });

      this._w = worker;
      for (const item of this._queue) {
        await this._send(item.data, item.transfer);
      }
      this._queue = [];
    }

    private async _send(data: unknown, transfer?: Transferable[]) {
      if (!this._w) return;
      const encoded = await encodeBlobs(data);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this._w.postMessage(encoded, transfer as any);
    }

    addEventListener(type: string, fn: (ev: unknown) => void) {
      if (!this._listeners.has(type)) this._listeners.set(type, new Set());
      this._listeners.get(type)!.add(fn);
    }

    removeEventListener(type: string, fn: (ev: unknown) => void) {
      this._listeners.get(type)?.delete(fn);
    }

    postMessage(data: unknown, transfer?: Transferable[]) {
      if (this._w) {
        void this._send(data, transfer);
      } else {
        this._queue.push({ data, transfer });
      }
    }

    terminate() {
      return this._w?.terminate();
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Worker = NodeWebWorkerShim;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let wasmC2paPromise: Promise<{ c2pa: any; Builder: any; Reader: any }> | null = null;

async function getWasmC2pa() {
  if (!wasmC2paPromise) {
    wasmC2paPromise = (async () => {
      installNodeWorkerShim();
      const mod = await import("@contentauth/c2pa-web/inline");
      const c2pa = await mod.createC2pa();
      return { c2pa, Builder: mod.Builder, Reader: mod.Reader };
    })();
  }
  return wasmC2paPromise;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function readManifestStoreWasm(buffer: Buffer, mimeType: string): Promise<{ store: any; activeManifest: any } | null> {
  const { c2pa, Reader } = await getWasmC2pa();
  const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  const blob = new Blob([ab], { type: mimeType });
  const reader = await Reader.fromBlob(c2pa, mimeType, blob);
  if (!reader) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = (await reader.manifestStore()) as any;
    const activeLabel = store?.active_manifest;
    const activeManifest = activeLabel ? store?.manifests?.[activeLabel] : null;
    return { store, activeManifest };
  } finally {
    await reader.free();
  }
}

export async function signWithWasm(params: {
  buffer: Buffer;
  mimeType: "image/jpeg" | "image/png";
  fileName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  manifestDefinition: any;
  hasExistingCredentials: boolean;
  signingTimeIso: string;
  actionName: string;
  digitalSourceType: string;
  requiresAiAssertion: boolean;
  modelType?: string;
  modelName?: string;
  certPem: string;
  keyPem: string;
}): Promise<Buffer> {
  const { c2pa, Builder } = await getWasmC2pa();
  const builder = await Builder.fromDefinition(c2pa, params.manifestDefinition);
  const ab = params.buffer.buffer.slice(
    params.buffer.byteOffset,
    params.buffer.byteOffset + params.buffer.byteLength
  ) as ArrayBuffer;
  const assetBlob = new Blob([ab], { type: params.mimeType });

  try {
    if (params.hasExistingCredentials) {
      const parentLabel = "parent-ingredient";
      await builder.addIngredientFromBlob(
        {
          title: params.fileName,
          label: parentLabel,
          relationship: "parentOf",
        },
        params.mimeType,
        assetBlob
      );
      await builder.addAction({
        action: "c2pa.opened",
        when: params.signingTimeIso,
        softwareAgent: { name: "Jingle Studio Tools", version: "1.0.0" },
        parameters: {
          ingredientIds: [parentLabel],
        },
      });
    } else if (params.actionName !== "c2pa.created") {
      await builder.addAction({
        action: "c2pa.created",
        when: params.signingTimeIso,
        softwareAgent: { name: "Jingle Studio Tools", version: "1.0.0" },
        digitalSourceType: params.digitalSourceType,
      });
    }

    if (params.requiresAiAssertion && params.modelType) {
      await builder.addAssertion("c2pa.ai-disclosure", {
        modelType: params.modelType.trim(),
        ...(params.modelName?.trim() ? { modelName: params.modelName.trim() } : {}),
        declaredBy: "self-declared",
      });
    }

    await builder.addAction({
      action: params.actionName,
      when: params.signingTimeIso,
      softwareAgent: { name: "Jingle Studio Tools", version: "1.0.0" },
      digitalSourceType: params.digitalSourceType,
    });

    const signedBytes = await builder.sign(
      {
        alg: "es256",
        reserveSize: async () => 16384,
        sign: async (data: Uint8Array, reserveSize: number) =>
          buildCoseSign1(data, params.certPem, params.keyPem, reserveSize),
      },
      params.mimeType,
      assetBlob
    );

    return Buffer.from(signedBytes);
  } finally {
    await builder.free();
  }
}
