export const metadata = {
  title: "Privacy Policy (Draft)",
};

export default function PrivacyPage() {
  return (
    <article className="max-w-3xl space-y-5 bg-white rounded-2xl border border-[var(--color-border)] p-6 sm:p-8">
      <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs font-medium text-amber-900">
        Draft for legal review before production launch.
      </div>
      <h1 className="text-2xl font-bold text-[var(--color-ink)]">Privacy Policy</h1>
      <p className="text-sm text-[var(--color-muted)] leading-relaxed">
        <strong>Free browser check tools:</strong> Files inspected using our free check tools are
        processed locally inside your browser using WebAssembly. They are not uploaded to our
        servers.
      </p>
      <p className="text-sm text-[var(--color-muted)] leading-relaxed">
        <strong>Batch signing service:</strong> Files uploaded for server-side C2PA signing are
        stored in private object storage, processed in an isolated Node runtime, and raw input files
        are deleted immediately after processing. Signed outputs are retained for 24 hours (or the
        configured TTL) for download and then deleted automatically.
      </p>
      <p className="text-sm text-[var(--color-muted)] leading-relaxed">
        <strong>Public proof pages:</strong> If you choose to publish a public proof page
        (`/p/[slug]`), we store only the asset title, thumbnail, signer name, self-declared
        disclosure, and signing timestamp—never GPS or personal camera EXIF capture data.
      </p>
    </article>
  );
}
