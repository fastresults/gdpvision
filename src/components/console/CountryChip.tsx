// Compact country identity chip: always visible so the user knows which country
// the session is scoped to — critical for super-admin view-as on mobile.

export function CountryChip({
  flagUrl,
  code,
  name,
  className = "",
}: {
  flagUrl: string | null;
  code: string;
  name?: string | null;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex min-h-9 items-center gap-2 border border-line-200 bg-paper-0 px-2.5 py-1 ${className}`}
      title={name ?? code}
    >
      {flagUrl && (
        <img src={flagUrl} alt="" className="h-3.5 w-5 shrink-0 rounded-sm object-cover" />
      )}
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-950">
        {code}
      </span>
      {name && (
        <span className="hidden max-w-[14ch] truncate font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 md:inline">
          {name}
        </span>
      )}
    </span>
  );
}
