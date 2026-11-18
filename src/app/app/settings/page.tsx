"use client";

import React, { useCallback, useEffect, useState } from "react";

interface SettingsPayload {
  activeWorkspace: { id: string; name: string };
  activeRole: string;
  workspaces: Array<{ id: string; name: string; role: string }>;
  members: Array<{ id: string; role: string; email: string; name: string | null }>;
  profiles: Array<{
    id: string;
    displayName: string;
    website: string | null;
    defaultTrainingPreference: boolean;
  }>;
}

export default function WorkspaceSettingsPage() {
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [website, setWebsite] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/workspaces");
    if (res.ok) {
      setData(await res.json());
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_profile",
        displayName,
        website,
        defaultTrainingPreference: true,
      }),
    });
    if (res.ok) {
      setDisplayName("");
      setWebsite("");
      setMessage("Brand signing profile saved.");
      await load();
    } else {
      const err = await res.json();
      setMessage(err.error || "Could not save profile.");
    }
  };

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const res = await fetch("/api/workspaces/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, role: "member" }),
    });
    const body = await res.json();
    if (res.ok) {
      setInviteToken(body.token);
      setInviteEmail("");
    } else {
      setMessage(body.error || "Could not create invite.");
    }
  };

  if (!data) {
    return <div className="py-12 text-center text-sm text-[var(--color-muted)]">Loading settings…</div>;
  }

  const canManage = data.activeRole === "owner" || data.activeRole === "admin";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-ink)]">Workspace &amp; Brand Profiles</h1>
        <p className="text-xs text-[var(--color-muted)]">
          Active workspace: <strong>{data.activeWorkspace.name}</strong> ({data.activeRole})
        </p>
      </div>

      {message && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-xs text-[var(--color-ink)]">
          {message}
        </div>
      )}

      <section className="rounded-2xl border border-[var(--color-border)] bg-white p-6 space-y-4">
        <h2 className="text-base font-semibold text-[var(--color-ink)]">Brand Signing Profiles</h2>
        {data.profiles.length > 0 ? (
          <ul className="space-y-2 text-xs">
            {data.profiles.map((p) => (
              <li
                key={p.id}
                className="rounded-lg border border-[var(--color-border)] px-3 py-2 flex justify-between"
              >
                <span className="font-medium">{p.displayName}</span>
                <span className="text-[var(--color-muted)]">{p.website || "No website"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-[var(--color-muted)]">No saved profiles yet.</p>
        )}

        {canManage && (
          <form onSubmit={saveProfile} className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <input
              type="text"
              required
              placeholder="Brand or creator name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs"
            />
            <input
              type="url"
              placeholder="https://brand.com"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs"
            />
            <button
              type="submit"
              className="rounded-lg bg-[var(--color-blue)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-electric)]"
            >
              Save profile
            </button>
          </form>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--color-border)] bg-white p-6 space-y-4">
        <h2 className="text-base font-semibold text-[var(--color-ink)]">Team Members</h2>
        <ul className="divide-y divide-[var(--color-border)] text-xs">
          {data.members.map((m) => (
            <li key={m.id} className="py-2 flex justify-between">
              <span>{m.email}</span>
              <span className="font-medium text-[var(--color-muted)]">{m.role}</span>
            </li>
          ))}
        </ul>

        {canManage && (
          <form onSubmit={sendInvite} className="flex flex-col sm:flex-row gap-2 pt-2">
            <input
              type="email"
              required
              placeholder="teammate@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1 rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs"
            />
            <button
              type="submit"
              className="rounded-lg bg-[var(--color-navy)] px-4 py-2 text-xs font-semibold text-white"
            >
              Create invite
            </button>
          </form>
        )}

        {inviteToken && (
          <p className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-950">
            Invite token created: <code>{inviteToken}</code>
          </p>
        )}
      </section>

      <section className="glass-surface p-6 space-y-3">
        <h2 className="text-base font-semibold text-[var(--plum)]">Account Sessions</h2>
        <p className="text-xs text-[var(--plum-muted)]">
          Sign out of all active sessions on every browser and device.
        </p>
        <button
          type="button"
          onClick={async () => {
            const res = await fetch("/api/auth/revoke-all", { method: "POST" });
            if (res.ok) {
              window.location.href = "/login";
            }
          }}
          className="rounded-full bg-[#a32032] px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
        >
          Sign out of all devices
        </button>
      </section>
    </div>
  );
}
