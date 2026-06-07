import { Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronUp,
  ChevronLeft,
  ExternalLink,
  Settings as SettingsIcon,
  Globe,
  Presentation,
  FileText,
  Film,
  Sparkles,
  Eye,
} from "lucide-react";
import { VIDEO_CATEGORIES, type Item, type ItemCategory } from "@/lib/items.functions";
import type { Settings } from "@/lib/settings.functions";
import { getItemThumbnail } from "@/lib/thumbnail";

const PdfViewer = lazy(() => import("./PdfViewer"));

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

function ThumbnailCard({
  item,
  categoryLabel,
  onClick,
}: {
  item: Item;
  categoryLabel: string;
  onClick: () => void;
}) {
  const isVideo = VIDEO_CATEGORIES.includes(item.category);
  const thumbUrl = getItemThumbnail(item);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const showProcessing =
    !isVideo &&
    !thumbUrl &&
    (item.thumbnail_status === "pending" || item.thumbnail_status === "processing");
  const showFallback =
    failed ||
    (!isVideo && !thumbUrl && item.thumbnail_status === "failed") ||
    (isVideo && failed);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col overflow-hidden rounded-2xl border text-left transition-all active:scale-[0.97]"
      style={{
        backgroundColor: "var(--eyeframe-card)",
        borderColor: "var(--eyeframe-border)",
      }}
    >
      {/* Thumbnail area */}
      <div
        className="relative aspect-[16/10] w-full overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in oklch, var(--eyeframe-accent) 18%, var(--eyeframe-bg)) 0%, var(--eyeframe-bg) 100%)",
        }}
      >
        {/* Shimmer while loading / processing */}
        {(showProcessing || (!loaded && thumbUrl && !showFallback)) && (
          <div
            className="absolute inset-0 animate-pulse"
            style={{
              background:
                "linear-gradient(90deg, transparent, color-mix(in oklch, var(--eyeframe-text) 8%, transparent), transparent)",
            }}
          />
        )}

        {/* Saved website screenshot */}
        {thumbUrl && !failed && (
          <img
            src={thumbUrl}
            alt={item.label}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className="h-full w-full object-cover object-top"
            style={{ opacity: loaded ? 1 : 0, transition: "opacity 300ms" }}
          />
        )}

        {/* Video poster frame */}
        {isVideo && !failed && (
          <video
            src={item.url}
            preload="metadata"
            muted
            playsInline
            onLoadedData={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className="h-full w-full object-cover"
          />
        )}

        {/* Processing label */}
        {showProcessing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-70">
            <CategoryIcon category={item.category} className="h-9 w-9" />
            <div className="text-[10px] uppercase tracking-wider">Generating preview…</div>
          </div>
        )}

        {/* Fallback (failed or unavailable) */}
        {showFallback && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 opacity-70">
            <CategoryIcon category={item.category} className="h-10 w-10" />
          </div>
        )}

        {/* Bottom gradient for legibility */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-12"
          style={{
            background:
              "linear-gradient(to top, color-mix(in oklch, var(--eyeframe-card) 70%, transparent), transparent)",
          }}
        />
      </div>

      {/* Meta */}
      <div className="flex flex-col gap-1 p-3">
        <div
          className="line-clamp-2 text-sm font-semibold leading-tight"
          style={{ color: "var(--eyeframe-text)" }}
        >
          {item.label}
        </div>
        <div className="flex items-center gap-1 text-[11px] opacity-50">
          <CategoryIcon category={item.category} className="h-3 w-3" />
          {categoryLabel}
        </div>
      </div>
    </button>
  );
}

export function MobileKiosk({ items, settings }: { items: Item[]; settings: Settings }) {
  const labels = settings;
  const CATEGORY_LABELS: Record<ItemCategory, string> = {
    websites: labels.label_websites,
    presentations: labels.label_presentations,
    docs: labels.label_docs,
    videos: labels.label_videos,
    brand: labels.label_brand,
  };

  const [category, setCategory] = useState<ItemCategory>("websites");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [active, setActive] = useState<Item | null>(null);
  const [blocked, setBlocked] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visible = useMemo(
    () => items.filter((i) => i.category === category).sort((a, b) => a.sort_order - b.sort_order),
    [items, category],
  );

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!active) {
      setBlocked(false);
      return;
    }
    setBlocked(false);
    if (!VIDEO_CATEGORIES.includes(active.category)) {
      timerRef.current = setTimeout(() => setBlocked(true), 3500);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active]);

  // Resource viewer (full-screen)
  if (active) {
    const isVideo = VIDEO_CATEGORIES.includes(active.category);
    const isPdf = active.category === "presentations" && !!active.pdf_storage_path;
    return (
      <div
        className="fixed inset-0 flex flex-col animate-in slide-in-from-bottom duration-300"
        style={{ backgroundColor: "var(--eyeframe-bg)", color: "var(--eyeframe-text)" }}
      >
        <div
          className="flex shrink-0 items-center gap-2 border-b px-2"
          style={{
            height: "calc(56px + env(safe-area-inset-top))",
            paddingTop: "env(safe-area-inset-top)",
            backgroundColor: "var(--eyeframe-topbar)",
            borderColor: "var(--eyeframe-border)",
          }}
        >
          <button
            type="button"
            onClick={() => setActive(null)}
            aria-label="Back"
            className="flex h-11 w-11 items-center justify-center rounded-full transition-colors active:bg-white/10"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div className="min-w-0 flex-1 truncate text-center text-sm font-medium">
            {active.label}
          </div>
          <a
            href={active.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open in browser"
            className="flex h-11 w-11 items-center justify-center rounded-full transition-colors active:bg-white/10"
          >
            <ExternalLink className="h-5 w-5" />
          </a>
        </div>

        <div className="relative flex-1">
          {isPdf ? (
            <Suspense
              fallback={
                <div className="flex h-full w-full items-center justify-center text-sm opacity-70">
                  Loading PDF viewer…
                </div>
              }
            >
              <PdfViewer url={active.url} label={active.label} />
            </Suspense>
          ) : isVideo ? (
            <video
              key={active.id}
              src={active.url}
              controls
              autoPlay
              playsInline
              className="h-full w-full bg-black object-contain"
            />
          ) : (
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
                  className="absolute inset-x-0 bottom-0 animate-in slide-in-from-bottom duration-300 p-4"
                  style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
                >
                  <div
                    className="flex flex-col items-center gap-4 rounded-2xl border p-6 text-center shadow-2xl"
                    style={{
                      backgroundColor: "var(--eyeframe-card)",
                      borderColor: "var(--eyeframe-border)",
                    }}
                  >
                    {active.favicon_asset_url || active.favicon_url ? (
                      <img
                        src={active.favicon_asset_url ?? active.favicon_url ?? ""}
                        alt=""
                        className="h-12 w-12 rounded-lg"
                      />
                    ) : (
                      <CategoryIcon category={active.category} className="h-12 w-12" />
                    )}
                    <div className="text-base font-semibold">{active.label}</div>
                    <div className="text-sm opacity-70">
                      This site can't be embedded on mobile.
                    </div>
                    <a
                      href={active.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
                      style={{
                        backgroundColor: "var(--eyeframe-accent)",
                        color: "var(--eyeframe-bg)",
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open in browser
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

  // Idle + bottom sheet browser
  return (
    <div
      className="relative h-[100dvh] w-screen overflow-hidden"
      style={{
        backgroundColor: "var(--eyeframe-bg)",
        color: "var(--eyeframe-text)",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 35%, color-mix(in oklch, var(--eyeframe-accent) 22%, transparent), transparent 65%)",
        }}
      />

      {/* Admin gear */}
      <Link
        to="/admin"
        aria-label="Admin"
        className="absolute right-3 z-20 flex h-11 w-11 items-center justify-center rounded-full backdrop-blur transition-colors active:bg-white/10"
        style={{
          top: "calc(env(safe-area-inset-top) + 8px)",
          color: "var(--eyeframe-text)",
        }}
      >
        <SettingsIcon className="h-5 w-5 opacity-70" />
      </Link>

      {/* Idle content */}
      <div
        className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-6 px-6 pb-[180px] text-center"
      >
        {labels.idle_image_url ? (
          <img
            src={labels.idle_image_url}
            alt={labels.kiosk_title}
            className="max-h-[45vh] max-w-[75%] object-contain drop-shadow-2xl"
          />
        ) : (
          <div
            className="flex h-24 w-24 items-center justify-center rounded-full border"
            style={{ borderColor: "var(--eyeframe-accent)" }}
          >
            <Eye className="h-12 w-12" style={{ color: "var(--eyeframe-accent)" }} />
          </div>
        )}
        <h1 className="text-3xl font-bold leading-tight tracking-tight">
          {labels.kiosk_title}
        </h1>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="mt-2 inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium opacity-80 transition-all active:scale-95"
          style={{ borderColor: "var(--eyeframe-border)" }}
        >
          <ChevronUp className="h-4 w-4 animate-bounce" />
          Tap to explore
        </button>
      </div>

      {/* Backdrop */}
      {sheetOpen && (
        <button
          type="button"
          aria-label="Close"
          onClick={() => setSheetOpen(false)}
          className="absolute inset-0 z-20 animate-in fade-in duration-200"
          style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
        />
      )}

      {/* Bottom sheet */}
      <BottomSheet open={sheetOpen} onOpenChange={setSheetOpen}>
        {/* Category pills */}
        <div
          className="flex shrink-0 gap-2 overflow-x-auto px-4 pb-3"
          style={{ scrollbarWidth: "none" }}
        >
          {(Object.keys(CATEGORY_LABELS) as ItemCategory[]).map((c) => {
            const isActive = c === category;
            return (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setCategory(c);
                  if (!sheetOpen) setSheetOpen(true);
                }}
                className="flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-all active:scale-95"
                style={{
                  backgroundColor: isActive
                    ? "var(--eyeframe-accent)"
                    : "transparent",
                  color: isActive ? "var(--eyeframe-bg)" : "var(--eyeframe-text)",
                  borderColor: isActive
                    ? "var(--eyeframe-accent)"
                    : "var(--eyeframe-border)",
                }}
              >
                <CategoryIcon category={c} className="h-4 w-4" />
                {CATEGORY_LABELS[c]}
              </button>
            );
          })}
        </div>

        {/* Grid */}
        <div
          className="min-h-0 flex-1 overflow-y-auto px-4 pb-4"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {visible.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-center text-sm opacity-60">
              Nothing here yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {visible.map((item) => (
                <ThumbnailCard
                  key={item.id}
                  item={item}
                  categoryLabel={CATEGORY_LABELS[item.category]}
                  onClick={() => setActive(item)}
                />
              ))}
            </div>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}

const PEEK_HEIGHT = 150;

function BottomSheet({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startYRef = useRef<number | null>(null);
  const startOpenRef = useRef(open);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  // Closed = sheet pushed down so only PEEK_HEIGHT is visible.
  // Open = sheet at top (offset 0).
  const sheetHeight =
    typeof window !== "undefined" ? window.innerHeight * 0.85 : 600;
  const closedTranslate = sheetHeight - PEEK_HEIGHT;
  const baseTranslate = open ? 0 : closedTranslate;
  const translateY = Math.max(
    0,
    Math.min(closedTranslate, baseTranslate + dragOffset),
  );

  const onPointerDown = (e: React.PointerEvent) => {
    startYRef.current = e.clientY;
    startOpenRef.current = open;
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (startYRef.current == null) return;
    setDragOffset(e.clientY - startYRef.current);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (startYRef.current == null) return;
    const delta = e.clientY - startYRef.current;
    startYRef.current = null;
    setDragging(false);
    setDragOffset(0);
    // Threshold ~60px: drag up opens, drag down closes
    if (startOpenRef.current && delta > 60) onOpenChange(false);
    else if (!startOpenRef.current && delta < -60) onOpenChange(true);
  };

  return (
    <div
      ref={sheetRef}
      className="absolute inset-x-0 bottom-0 z-30 flex flex-col rounded-t-3xl border-t shadow-2xl"
      style={{
        height: "85dvh",
        transform: `translateY(${translateY}px)`,
        transition: dragging ? "none" : "transform 300ms cubic-bezier(0.32, 0.72, 0, 1)",
        backgroundColor: "var(--eyeframe-card)",
        borderColor: "var(--eyeframe-border)",
        paddingBottom: "env(safe-area-inset-bottom)",
        touchAction: "none",
      }}
    >
      {/* Drag handle */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={() => {
          if (Math.abs(dragOffset) < 4) onOpenChange(!open);
        }}
        className="flex w-full shrink-0 cursor-grab flex-col items-center gap-2 pt-3 pb-3 active:cursor-grabbing"
        role="button"
        aria-label={open ? "Collapse" : "Expand"}
        style={{ touchAction: "none" }}
      >
        <div
          className="h-1.5 w-12 rounded-full"
          style={{ backgroundColor: "var(--eyeframe-border)" }}
        />
      </div>

      {children}
    </div>
  );
}
