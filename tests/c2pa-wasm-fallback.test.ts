import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Reader } from "@contentauth/c2pa-node";
import { readManifestStoreWasm, signWithWasm } from "@/lib/c2pa-wasm-node";

const SAMPLE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

function generateDevTestCert(): { certPem: string; keyPem: string } {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wasm-cert-test-"));
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
    fs.writeFileSync(caKeyPath, caPrivateKey, "utf8");
    fs.writeFileSync(
      caExtPath,
      "[req]\ndistinguished_name=dn\nx509_extensions=v3_ca\nprompt=no\n[dn]\nCN=Jingle Test CA\nO=Jingle Studio (Test)\n[v3_ca]\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid:always,issuer\nbasicConstraints=critical,CA:TRUE\nkeyUsage=critical,keyCertSign,cRLSign\n",
      "utf8"
    );
    execFileSync("openssl", [
      "req", "-new", "-x509", "-key", caKeyPath, "-out", caCertPath,
      "-days", "1", "-config", caExtPath,
    ]);

    const { privateKey: leafPrivateKey } = crypto.generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    fs.writeFileSync(keyPath, leafPrivateKey, "utf8");
    fs.writeFileSync(
      leafExtPath,
      "[req]\ndistinguished_name=dn\nprompt=no\n[dn]\nCN=Jingle WASM Signer\nO=Jingle Studio (Test)\n[v3_leaf]\nbasicConstraints=critical,CA:FALSE\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid,issuer\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=emailProtection\n",
      "utf8"
    );
    execFileSync("openssl", [
      "req", "-new", "-key", keyPath, "-out", csrPath, "-config", leafExtPath,
    ]);
    execFileSync("openssl", [
      "x509", "-req", "-sha256", "-in", csrPath, "-CA", caCertPath, "-CAkey", caKeyPath,
      "-CAcreateserial", "-out", certPath, "-days", "1", "-extfile", leafExtPath, "-extensions", "v3_leaf",
    ]);

    const certPem = fs.readFileSync(certPath, "utf8") + "\n" + fs.readFileSync(caCertPath, "utf8");
    return { certPem, keyPem: leafPrivateKey };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

describe("WASM Node fallback signing & reading", () => {
  it("signs an image in pure WASM, preserves parent ingredients, and validates cleanly", async () => {
    const { certPem, keyPem } = generateDevTestCert();
    const now = new Date().toISOString();

    const signedBuffer = await signWithWasm({
      buffer: SAMPLE_PNG,
      mimeType: "image/png",
      fileName: "wasm-test.png",
      manifestDefinition: {
        title: "wasm-test.png",
        format: "image/png",
        claim_generator_info: [{ name: "Jingle Studio Tools", version: "1.0.0" }],
        assertions: [],
      },
      hasExistingCredentials: false,
      signingTimeIso: now,
      actionName: "c2pa.created",
      digitalSourceType:
        "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia",
      requiresAiAssertion: true,
      modelType: "imageGeneration",
      modelName: "WasmGen",
      certPem,
      keyPem,
    });

    const wasmRead = await readManifestStoreWasm(signedBuffer, "image/png");
    expect(wasmRead).not.toBeNull();
    const hardFailures = (wasmRead?.store?.validation_status || []).filter(
      (s: { code?: string }) => {
        const c = (s.code || "").toLowerCase();
        return c.includes("mismatch") || c.includes("invalid") || c.includes("missing") || c.includes("error");
      }
    );
    expect(hardFailures).toEqual([]);
    expect(wasmRead?.activeManifest?.signature_info?.issuer).toBe("Jingle Studio (Test)");

    // Verify cross-compatibility with native c2pa-node Reader
    const nativeReader = await Reader.fromAsset({ buffer: signedBuffer, mimeType: "image/png" });
    expect(nativeReader).not.toBeNull();
    expect(nativeReader?.json()?.validation_state).not.toBe("Invalid");

    // Re-sign with WASM preserving parent ingredient
    const resignedBuffer = await signWithWasm({
      buffer: signedBuffer,
      mimeType: "image/png",
      fileName: "wasm-resigned.png",
      manifestDefinition: {
        title: "wasm-resigned.png",
        format: "image/png",
        claim_generator_info: [{ name: "Jingle Studio Tools", version: "1.0.0" }],
        assertions: [],
      },
      hasExistingCredentials: true,
      signingTimeIso: now,
      actionName: "c2pa.edited",
      digitalSourceType:
        "http://cv.iptc.org/newscodes/digitalsourcetype/humanEdits",
      requiresAiAssertion: false,
      certPem,
      keyPem,
    });

    const resignedRead = await readManifestStoreWasm(resignedBuffer, "image/png");
    expect(resignedRead?.activeManifest?.ingredients?.length).toBeGreaterThanOrEqual(1);
    const resignedHardFailures = (resignedRead?.store?.validation_status || []).filter(
      (s: { code?: string }) => {
        const c = (s.code || "").toLowerCase();
        return c.includes("mismatch") || c.includes("invalid") || c.includes("missing") || c.includes("error");
      }
    );
    expect(resignedHardFailures).toEqual([]);
  });
});
