import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { lazy, Suspense, useState } from "react";
import { getGateStatus, unlockSite } from "@/lib/site-gate/gate.functions";
import ogImage from "@/assets/gdpvision-og.jpg";

const MarketingHome = lazy(() =>
  import("@/components/marketing/MarketingHome").then((m) => ({ default: m.MarketingHome })),
);

const SITE_URL = "https://gdpvision.com";
const TITLE = "GDPVision — test national economic decisions before committing";
const DESCRIPTION =
  "A government-controlled decision system for Presidents, Prime Ministers and Cabinets: bring national data together, test choices before committing, and follow decisions through delivery.";

export const Route = createFileRoute("/")({
  loader: () => getGateStatus(),
  head: () => {
    const absoluteOg = ogImage.startsWith("http") ? ogImage : `${SITE_URL}${ogImage}`;
    return {
      meta: [
        { title: TITLE },
        { name: "description", content: DESCRIPTION },
        { property: "og:title", content: TITLE },
        { property: "og:description", content: DESCRIPTION },
        { property: "og:type", content: "website" },
        { property: "og:url", content: SITE_URL + "/" },
        { property: "og:image", content: absoluteOg },
        { name: "twitter:title", content: TITLE },
        { name: "twitter:description", content: DESCRIPTION },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: absoluteOg },
      ],
      links: [{ rel: "canonical", href: SITE_URL + "/" }],
    };
  },
  component: HomeGate,
});

function HomeGate() {
  const { unlocked } = Route.useLoaderData();
  if (!unlocked) return <SiteGate />;
  return (
    <Suspense fallback={<div className="min-h-dvh bg-paper-0" />}>
      <div className="animate-in fade-in duration-500 motion-reduce:animate-none">
        <MarketingHome />
      </div>
    </Suspense>
  );
}

function SiteGate() {
  const router = useRouter();
  const unlock = useServerFn(unlockSite);
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await unlock({ data: { password: value } });
    setBusy(false);
    if (res.ok) await router.invalidate();
    else {
      setError(true);
      setValue("");
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper-0 px-4">
      <form onSubmit={onSubmit} className="flex w-full max-w-xs flex-col gap-3">
        <label htmlFor="site-password" className="sr-only">
          Password
        </label>
        <input
          id="site-password"
          type="password"
          autoFocus
          autoComplete="current-password"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(false);
          }}
          placeholder="Password"
          className="rounded-md border border-line-200 bg-paper-0 px-3 py-2 text-ink-900 outline-none focus:border-ink-500"
        />
        {error && (
          <p role="alert" className="text-sm text-signal-red">
            Incorrect password
          </p>
        )}
        <button type="submit" className="btn-primary" disabled={busy}>
          Enter
        </button>
      </form>
    </main>
  );
}
