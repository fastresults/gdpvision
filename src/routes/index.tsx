import { createFileRoute, Link, ClientOnly } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
const PdfViewer = lazy(() => import("@/components/mobile/PdfViewer"));
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
  PanelTopOpen,
  PanelTopClose,
} from "lucide-react";
import { DEFAULT_SETTINGS, PDF_CATEGORIES, VIDEO_CATEGORIES, type Item, type ItemCategory, type Settings } from "@/lib/kiosk-types";
import { MobileKiosk } from "@/components/mobile/MobileKiosk";

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

type KioskData = { items: Item[]; settings: Settings };

async function fetchKioskData(): Promise<KioskData> {
  const response = await fetch("/api/kiosk-data");
  if (!response.ok) throw new Error("Failed to load kiosk data");
  return response.json();
}

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
  const { data } = useQuery({
    queryKey: ["kiosk-data"],
    queryFn: fetchKioskData,
    refetchOnWindowFocus: true,
    refetchInterval: (q) => {
      const pending = (q.state.data?.items ?? []).some(
        (i) => i.thumbnail_status === "pending" || i.thumbnail_status === "processing",
      );
      return pending ? 4000 : false;
    },
  });
  const items = data?.items ?? [];
  const labels: Settings = data?.settings ?? DEFAULT_SETTINGS;
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
  const [pdfToolbarOpen, setPdfToolbarOpen] = useState(false);

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
    const isPdfActive = PDF_CATEGORIES.includes(active.category) && !!active.pdf_storage_path;
    const isVideoActive = VIDEO_CATEGORIES.includes(active.category);
    if (!isPdfActive && !isVideoActive) {
      timerRef.current = setTimeout(() => setBlocked(true), 3500);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active]);

  if (isMobile) {
    return <MobileKiosk items={items} settings={labels} />;
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
            <div className="relative flex h-full w-full flex-col items-center justify-center gap-4" style={{ backgroundColor: "var(--eyeframe-bg)" }}>
              <img
                src={labels.idle_image_url}
                alt={labels.kiosk_title}
                className="max-h-[30%] max-w-[30%] object-contain"
              />
              <div className="text-center text-[2.625rem] font-bold leading-tight opacity-90">
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

        {active && !VIDEO_CATEGORIES.includes(active.category) && PDF_CATEGORIES.includes(active.category) && active.pdf_storage_path && (
          <ClientOnly fallback={<div className="flex h-full w-full items-center justify-center text-sm opacity-70">Loading PDF viewer…</div>}>
            <Suspense fallback={<div className="flex h-full w-full items-center justify-center text-sm opacity-70">Loading PDF viewer…</div>}>
              <PdfViewer url={active.url} label={active.label} storagePath={active.pdf_storage_path} />
            </Suspense>
          </ClientOnly>
        )}

        {active && !VIDEO_CATEGORIES.includes(active.category) && !(PDF_CATEGORIES.includes(active.category) && active.pdf_storage_path) && (
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
                  {active.favicon_asset_url || active.favicon_url ? (
                    <img src={active.favicon_asset_url ?? active.favicon_url ?? ""} alt="" className="h-10 w-10 rounded" />
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
