"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { KeyRound, Trash2 } from "lucide-react";

interface ApiKeyRow {
  id: string;
  keyPrefix: string;
  label: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export default function AppDevelopersPage() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [label, setLabel] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/keys");
    if (res.status === 401) {
      setError("Sign in to manage workspace API keys.");
      return;
    }
    if (res.ok) {
      const data = await res.json();
      setKeys(data.keys || []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setRevealedKey(null);
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: label || "API Key" }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error || "Could not create API key.");
      return;
    }
    setRevealedKey(body.rawKey);
    setLabel("");
    await load();
  };

  const revokeKey = async (id: string) => {
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke", id }),
    });
    if (res.ok) await load();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--plum)]">Workspace API Keys</h1>
          <p className="text-xs text-[var(--plum-muted)]">
            Use API keys with the REST API (`/api/v1/*`) and MCP server (`/api/mcp`).
          </p>
        </div>
        <Link href="/developers/docs" className="btn-mint px-4 py-2 text-xs font-semibold">
          Read API docs
        </Link>
      </div>

      {error && (
        <div className="rounded-[20px] border border-[#a32032]/30 bg-rose-100/90 p-4 text-xs text-[var(--plum)]">
          {error}{" "}
          <Link href="/login?callbackUrl=/app/developers" className="underline font-semibold">
            Sign in
          </Link>
        </div>
      )}

      {revealedKey && (
        <div className="rounded-[20px] border border-[rgba(63,17,61,0.2)] bg-[var(--lime)]/70 p-4 space-y-1 text-xs text-[var(--plum)]">
          <p className="font-bold">Copy your API key now—it will not be shown again:</p>
          <code className="block break-all rounded-lg bg-white/80 px-3 py-2 font-mono">
            {revealedKey}
          </code>
        </div>
      )}

      <section className="glass-surface p-6 space-y-4">
        <h2 className="text-base font-semibold text-[var(--plum)]">Create API Key</h2>
        <form onSubmit={createKey} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Key label (e.g. CI Pipeline)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="flex-1 glass-input px-3.5 py-2 text-sm"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 btn-plum px-5 py-2 text-xs font-semibold"
          >
            <KeyRound aria-hidden="true" className="h-4 w-4" />
            Generate key
          </button>
        </form>
      </section>

      <section className="glass-surface p-6 space-y-3">
        <h2 className="text-base font-semibold text-[var(--plum)]">Active &amp; Revoked Keys</h2>
        {keys.length === 0 ? (
          <p className="text-xs text-[var(--plum-muted)]">No API keys created yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[rgba(63,17,61,0.12)] text-[var(--plum-muted)]">
                  <th scope="col" className="py-2 pr-4">Label</th>
                  <th scope="col" className="py-2 pr-4">Prefix</th>
                  <th scope="col" className="py-2 pr-4">Status</th>
                  <th scope="col" className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className="border-b border-[rgba(63,17,61,0.08)] last:border-0">
                    <td className="py-2.5 pr-4 font-medium">{k.label}</td>
                    <td className="py-2.5 pr-4 font-mono">{k.keyPrefix}…</td>
                    <td className="py-2.5 pr-4">{k.revokedAt ? "Revoked" : "Active"}</td>
                    <td className="py-2.5">
                      {!k.revokedAt && (
                        <button
                          type="button"
                          onClick={() => void revokeKey(k.id)}
                          className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 font-medium text-[#a32032]"
                        >
                          <Trash2 aria-hidden="true" className="h-3 w-3" />
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
