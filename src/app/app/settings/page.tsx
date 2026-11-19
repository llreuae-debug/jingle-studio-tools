"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface SettingsPayload {
  user?: { email: string; name: string | null; emailVerified: string | null };
  plan?: {
    id: string;
    name: string;
    dailyLimit: number;
    maxImageMb: number;
    maxVideoMb: number;
  };
  balance?: number;
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
  const router = useRouter();
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [website, setWebsite] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [revokingAll, setRevokingAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/workspaces");
      if (res.status === 401) {
        router.replace("/login?callbackUrl=/app/settings");
        return;
      }
      if (!res.ok) {
        setLoadError("Could not load workspace settings.");
        return;
      }
      setData(await res.json());
    } catch {
      setLoadError("Network error loading workspace settings.");
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingProfile) return;
    setSavingProfile(true);
    setMessage(null);
    try {
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
        const err = await res.json().catch(() => ({}));
        setMessage(err.error || "Could not save profile.");
      }
    } catch {
      setMessage("Network error saving profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inviting) return;
    setInviting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/workspaces/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: "member" }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setInviteToken(body.token);
        setInviteEmail("");
      } else {
        setMessage(body.error || "Could not create invite.");
      }
    } catch {
      setMessage("Network error creating invite.");
    } finally {
      setInviting(false);
    }
  };

  if (loadError) {
    return (
      <div role="alert" className="rounded-[14px] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">
        {loadError}
      </div>
    );
  }

  if (!data) {
    return <div className="py-12 text-center text-sm text-[var(--color-muted)]">Loading settings…</div>;
  }

  const canManage = data.activeRole === "owner" || data.activeRole === "admin";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-ink)]">Account, Workspace &amp; Brand Profiles</h1>
        <p className="text-xs text-[var(--color-muted)]">
          Active workspace: <strong>{data.activeWorkspace.name}</strong> ({data.activeRole})
        </p>
      </div>

      {data.user && (
        <section className="glass-surface p-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <p className="text-[var(--color-text-muted)]">Account</p>
            <p className="font-semibold text-[var(--color-ink)]">{data.user.name || data.user.email}</p>
            <p className="text-[var(--color-text-muted)]">{data.user.email}</p>
            <p className="mt-1">
              {data.user.emailVerified ? (
                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  Email verified
                </span>
              ) : (
                <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                  Email unverified
                </span>
              )}
            </p>
          </div>
          <div>
            <p className="text-[var(--color-text-muted)]">Active Subscription Plan</p>
            <p className="font-semibold text-[var(--color-ink)]">{data.plan?.name || "Free"}</p>
            <p className="text-[var(--color-text-muted)]">
              {data.plan?.dailyLimit ?? 20} files/day • {data.plan?.maxImageMb ?? 25} MB img / {data.plan?.maxVideoMb ?? 100} MB video
            </p>
          </div>
          <div>
            <p className="text-[var(--color-text-muted)]">Credits &amp; Billing</p>
            <p className="font-semibold text-[var(--color-ink)]">{data.balance ?? 0} credits remaining</p>
            <Link href="/app/billing" className="text-[var(--color-brand)] font-semibold underline">
              Manage credits &amp; invoices
            </Link>
          </div>
        </section>
      )}

      {message && (
        <div className="rounded-[16px] border border-[var(--color-brand-line)] bg-[var(--warm-peach)]/60 px-4 py-2.5 text-xs text-[var(--espresso-black)]">
          {message}
        </div>
      )}

      <section className="glass-surface p-6 space-y-4">
        <h2 className="text-base font-semibold text-[var(--espresso-black)]">Brand Signing Profiles</h2>
        {data.profiles.length > 0 ? (
          <ul className="space-y-2 text-xs">
            {data.profiles.map((p) => (
              <li
                key={p.id}
                className="rounded-[12px] border border-[var(--border)] bg-white/75 px-3 py-2 flex justify-between"
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
              className="glass-input px-3 py-2 text-xs"
            />
            <input
              type="url"
              placeholder="https://brand.com"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="glass-input px-3 py-2 text-xs"
            />
            <button
              type="submit"
              disabled={savingProfile}
              className="btn-plum px-4 py-2 text-xs font-semibold disabled:opacity-60"
            >
              {savingProfile ? "Saving…" : "Save profile"}
            </button>
          </form>
        )}
      </section>

      <section className="glass-surface p-6 space-y-4">
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
              className="flex-1 glass-input px-3 py-2 text-xs"
            />
            <button
              type="submit"
              disabled={inviting}
              className="btn-plum px-4 py-2 text-xs font-semibold disabled:opacity-60"
            >
              {inviting ? "Creating invite…" : "Create invite"}
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
          disabled={revokingAll}
          onClick={async () => {
            setRevokingAll(true);
            try {
              const res = await fetch("/api/auth/revoke-all", { method: "POST" });
              if (res.ok) {
                window.location.href = "/login";
              } else {
                setMessage("Could not sign out all sessions.");
                setRevokingAll(false);
              }
            } catch {
              setMessage("Network error signing out sessions.");
              setRevokingAll(false);
            }
          }}
          className="rounded-full bg-[#a32032] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {revokingAll ? "Signing out…" : "Sign out of all devices"}
        </button>
      </section>
    </div>
  );
}
