import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  FileText,
  Globe,
  Presentation,
  ExternalLink,
  Settings as SettingsIcon,
  Eye,
  Film,
  Sparkles,
} from "lucide-react";
import { listItems, VIDEO_CATEGORIES, type Item, type ItemCategory } from "@/lib/items.functions";
import { listSettings, type Settings } from "@/lib/settings.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GDP Vision — Kiosk" },
      {
        name: "description",
        content: "Full-screen browser demonstration system.",
      },
    ],
  }),
  component: KioskPage,
});

const CATEGORY_SETTING_KEY = {
  websites: "label_websites",
  presentations: "label_presentations",
  docs: "label_docs",
  videos: "label_videos",
  brand: "label_brand",
} as const;

function CategoryIcon({ category, className }: { category: ItemCategory; className?: string }) {
  const Icon =
    category === "websites"
      ? Globe
      : category === "presentations"
        ? Presentation
        : category === "docs"
          ? FileText
          : category === "videos"
            ? Film
            : Sparkles;
  return <Icon className={className} />;
}

function KioskPage() {
  const fetchItems = useServerFn(listItems);
  const fetchSettings = useServerFn(listSettings);
  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: () => fetchItems(),
    refetchOnWindowFocus: true,
  });
  const { data: settings } = useQuery<Settings>({
    queryKey: ["settings"],
    queryFn: () => fetchSettings(),
    refetchOnWindowFocus: true,
    refetchInterval: 5000,
    staleTime: 0,
  });
  const labels: Settings = settings ?? {
    admin_title: "GDP Vision Admin",
    kiosk_title: "GDP Vision",
    label_websites: "Websites",
    label_presentations: "Presentations",
    label_docs: "Google Docs",
    label_videos: "Past Events",
    label_brand: "Brand Building",
    idle_image_url: "",
  };
  const CATEGORY_LABELS: Record<ItemCategory, string> = {
    websites: labels.label_websites,
    presentations: labels.label_presentations,
    docs: labels.label_docs,
    videos: labels.label_videos,
    brand: labels.label_brand,
  };
  void CATEGORY_SETTING_KEY;

  const [category, setCategory] = useState<ItemCategory>("websites");
  const [active, setActive] = useState<Item | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const visible = useMemo(
    () => items.filter((i) => i.category === category).sort((a, b) => a.sort_order - b.sort_order),
    [items, category],
  );

  useEffect(() => {
    setActive(null);
    setBlocked(false);
  }, [category]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!active) {
      setBlocked(false);
      return;
    }
    setBlocked(false);
    timerRef.current = setTimeout(() => setBlocked(true), 3500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active]);

  if (isMobile) {
    return (
      <div
        className="flex h-screen w-screen items-center justify-center px-6 text-center"
        style={{
          backgroundColor: "var(--eyeframe-bg)",
          color: "var(--eyeframe-text)",
          fontFamily: "var(--font-sans)",
        }}
      >
        <p className="text-base">GDP Vision is optimized for desktop</p>
      </div>
    );
  }

  return (
    <div
      className="grid h-screen w-screen overflow-hidden"
      style={{
        gridTemplateRows: "4.6vh 95.4vh",
        backgroundColor: "var(--eyeframe-bg)",
        color: "var(--eyeframe-text)",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* Top bar */}
      <div
        className="flex h-full w-full items-center gap-2 px-2"
        style={{ backgroundColor: "var(--eyeframe-topbar)", overflow: "hidden" }}
      >
        {/* Dropdown */}
        <div className="relative shrink-0" style={{ width: 144 }}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            onBlur={() => setTimeout(() => setMenuOpen(false), 120)}
            className="flex h-[23px] w-full items-center justify-between rounded-md border px-2 text-xs font-medium transition-colors"
            style={{
              backgroundColor: "var(--eyeframe-card)",
              borderColor: "var(--eyeframe-border)",
              color: "var(--eyeframe-text)",
            }}
          >
            <span className="flex items-center gap-1.5">
              <Eye className="h-3 w-3" style={{ color: "var(--eyeframe-accent)" }} />
              <span className="opacity-70">{CATEGORY_LABELS[category]}</span>
            </span>
            <ChevronDown className="h-3 w-3 opacity-70" />
          </button>
          {menuOpen && (
            <div
              className="fixed mt-1 overflow-hidden rounded-md border shadow-xl"
              style={{
                left: 8,
                top: "4.6vh",
                width: 144,
                zIndex: 9999,
                backgroundColor: "var(--eyeframe-card)",
                borderColor: "var(--eyeframe-border)",
              }}
            >
              {(Object.keys(CATEGORY_LABELS) as ItemCategory[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setCategory(c);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm opacity-70 transition-colors hover:brightness-125"
                  style={{ color: "var(--eyeframe-text)" }}
                >
                  <CategoryIcon category={c} className="h-3.5 w-3.5 opacity-80" />
                  {CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Thumbnail strip */}
        <div
          className="flex h-full min-w-0 flex-1 items-center gap-2 overflow-x-auto overflow-y-hidden"
          style={{ scrollbarWidth: "thin" }}
        >
          {visible.length === 0 && (
            <span className="text-xs opacity-60">
              No items in this category. Add some in /admin.
            </span>
          )}
          {visible.map((item) => {
            const isActive = active?.id === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActive(item)}
                title={item.label}
                className="group flex h-[31px] shrink-0 items-center justify-center gap-2 rounded-md border px-2 transition-all hover:brightness-125"
                style={{
                  width: 101,
                  backgroundColor: "var(--eyeframe-card)",
                  borderColor: isActive ? "var(--eyeframe-accent)" : "var(--eyeframe-border)",
                  borderBottomWidth: isActive ? 3 : 1,
                }}
              >
                <span className="w-full truncate text-center text-xs opacity-70" style={{ color: "var(--eyeframe-text)" }}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        <Link
          to="/admin"
          className="flex h-[23px] shrink-0 items-center gap-1 rounded-md border px-2 text-xs opacity-70 transition-colors hover:brightness-125"
          style={{
            backgroundColor: "var(--eyeframe-card)",
            borderColor: "var(--eyeframe-border)",
            color: "var(--eyeframe-text)",
          }}
        >
          <SettingsIcon className="h-3 w-3" />
          Admin
        </Link>
      </div>


      {/* Preview area */}
      <div className="relative h-full w-full" style={{ backgroundColor: "var(--eyeframe-bg)" }}>
        {!active && (
          labels.idle_image_url ? (
            <div className="relative flex h-full w-full items-center justify-center" style={{ backgroundColor: "var(--eyeframe-bg)" }}>
              <img
                src={labels.idle_image_url}
                alt={labels.kiosk_title}
                className="h-full w-full object-contain"
              />
              <div className="pointer-events-none absolute bottom-6 left-0 right-0 text-center text-sm opacity-70">
                {labels.kiosk_title}
              </div>
            </div>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-4">
              <div
                className="flex h-20 w-20 items-center justify-center rounded-full border"
                style={{ borderColor: "var(--eyeframe-accent)" }}
              >
                <Eye className="h-10 w-10" style={{ color: "var(--eyeframe-accent)" }} />
              </div>
              <div className="text-2xl font-semibold tracking-tight">{labels.admin_title}</div>
              <div className="text-sm opacity-70">Select a resource above to begin</div>
            </div>
          )
        )}

        {active && VIDEO_CATEGORIES.includes(active.category) && (
          <video
            key={active.id}
            src={active.url}
            controls
            autoPlay
            playsInline
            className="h-full w-full bg-black object-contain"
          />
        )}

        {active && !VIDEO_CATEGORIES.includes(active.category) && (
          <>
            <iframe
              key={active.id}
              src={active.url}
              title={active.label}
              className="h-full w-full"
              style={{ border: 0, display: "block" }}
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              allow="fullscreen"
              onLoad={() => {
                if (timerRef.current) clearTimeout(timerRef.current);
                setBlocked(false);
              }}
            />
            {blocked && (
              <div
                className="pointer-events-auto absolute inset-0 flex items-center justify-center"
                style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
              >
                <div
                  className="flex max-w-md flex-col items-center gap-4 rounded-lg border p-8 text-center"
                  style={{
                    backgroundColor: "var(--eyeframe-card)",
                    borderColor: "var(--eyeframe-border)",
                  }}
                >
                  {active.favicon_url ? (
                    <img src={active.favicon_url} alt="" className="h-10 w-10 rounded" />
                  ) : (
                    <CategoryIcon category={active.category} className="h-10 w-10" />
                  )}
                  <div className="text-lg font-semibold">{active.label}</div>
                  <div className="text-sm opacity-70">
                    This site can't be embedded in an iframe.
                  </div>
                  <a
                    href={active.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium"
                    style={{
                      backgroundColor: "var(--eyeframe-accent)",
                      color: "var(--eyeframe-bg)",
                    }}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open in new tab
                  </a>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
