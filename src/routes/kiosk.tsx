import { createFileRoute, Link, ClientOnly } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
const PdfViewer = lazy(() => import("@/components/mobile/PdfViewer"));
import {
  ChevronDown,
  ExternalLink,
  Settings as SettingsIcon,
  Eye,
  PanelTopOpen,
  PanelTopClose,
} from "lucide-react";
import {
  DEFAULT_SETTINGS,
  getCategoryIcon,
  type Category,
  type Gallery,
  type GalleryItem,
  type Item,
  type ItemCategory,
  type Settings,
} from "@/lib/kiosk-types";
import { MobileKiosk } from "@/components/mobile/MobileKiosk";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@/components/ui/carousel";
import { GalleryView } from "@/components/GalleryView";
import { MarketingHome } from "@/components/marketing/MarketingHome";
import { getRequestSiteMode } from "@/lib/site-mode.functions";
import { PRESENT_HOST, type SiteMode } from "@/lib/site-mode";


type IdleImage = {
  id: string;
  image_url: string;
  caption: string | null;
  sort_order: number;
};


export const Route = createFileRoute("/kiosk")({
  loader: async (): Promise<{ mode: SiteMode }> => {
    try {
      const { mode } = await getRequestSiteMode();
      return { mode };
    } catch {
      return { mode: "present" };
    }
  },
  head: ({ loaderData }) => {
    const isMarketing = loaderData?.mode === "marketing";
    return {
      meta: isMarketing
        ? [
            { title: "GDP Vision — Immersive presentation systems" },
            {
              name: "description",
              content:
                "GDP Vision builds full-screen briefing environments for Caribbean summits, ministries, and enterprises.",
            },
            { property: "og:title", content: "GDP Vision" },
            {
              property: "og:description",
              content:
                "Immersive presentation systems for the Caribbean's next decade.",
            },
          ]
        : [
            { title: "GDP Vision — Kiosk" },
            {
              name: "description",
              content: "Full-screen browser demonstration system.",
            },
          ],
    };
  },
  component: RootIndex,
});

function RootIndex() {
  const { mode: loaderMode } = Route.useLoaderData();
  const browserHost = typeof window === "undefined" ? "" : window.location.hostname.toLowerCase();
  const mode: SiteMode = browserHost === PRESENT_HOST ? "present" : loaderMode;

  if (mode === "marketing") return <MarketingHome />;
  return <KioskPage />;
}

type KioskData = {
  items: Item[];
  settings: Settings;
  idleImages?: IdleImage[];
  categories?: Category[];
  galleries?: Gallery[];
  galleryItems?: GalleryItem[];
};

async function fetchKioskData(): Promise<KioskData> {
  const response = await fetch("/api/kiosk-data");
  if (!response.ok) throw new Error("Failed to load kiosk data");
  return response.json();
}

function CategoryIcon({ iconName, className }: { iconName: string | null | undefined; className?: string }) {
  const Icon = getCategoryIcon(iconName);
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
  const categories: Category[] = data?.categories ?? [];
  const galleries: Gallery[] = data?.galleries ?? [];
  const galleryItems: GalleryItem[] = data?.galleryItems ?? [];
  const findCat = (slug: string) => categories.find((c) => c.slug === slug);


  const [category, setCategory] = useState<string>("");
  const [active, setActive] = useState<Item | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pdfToolbarOpen, setPdfToolbarOpen] = useState(false);

  // When categories load, default to the first one if nothing selected (or current selection vanished).
  useEffect(() => {
    if (categories.length === 0) return;
    if (!category || !categories.some((c) => c.slug === category)) {
      setCategory(categories[0].slug);
    }
  }, [categories, category]);

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
    setPdfToolbarOpen(false);
  }, [active?.id]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!active) {
      setBlocked(false);
      return;
    }
    setBlocked(false);
    const activeBehavior = findCat(active.category)?.behavior;
    const isPdfActive = activeBehavior === "pdf" && !!active.pdf_storage_path;
    const isVideoActive = activeBehavior === "video";
    if (!isPdfActive && !isVideoActive) {
      timerRef.current = setTimeout(() => setBlocked(true), 3500);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, categories]);

  if (isMobile) {
    return <MobileKiosk items={items} settings={labels} />;
  }

  const currentCat = findCat(category);
  const isGalleryCat = currentCat?.behavior === "gallery";
  const activeBehavior = active ? findCat(active.category)?.behavior : undefined;
  const isActivePdf = activeBehavior === "pdf" && !!active?.pdf_storage_path;
  const isActiveVideo = activeBehavior === "video";


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
              <span className="opacity-70">{currentCat?.label ?? ""}</span>
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
              {categories.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setCategory(c.slug);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm opacity-70 transition-colors hover:brightness-125"
                  style={{ color: "var(--eyeframe-text)" }}
                >
                  <CategoryIcon iconName={c.icon} className="h-3.5 w-3.5 opacity-80" />
                  {c.label}
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
          {isGalleryCat ? (
            <span className="text-xs opacity-60">Browse galleries below.</span>
          ) : (
            <>
              {visible.length === 0 && (
                <span className="text-xs opacity-60">
                  No items in this category. Add some in /admin.
                </span>
              )}
              <TooltipProvider delayDuration={200}>
              {visible.map((item) => {
                const isActive = active?.id === item.id;
                const btn = (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActive(item)}
                    title={item.tooltip ? undefined : item.label}
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
                if (!item.tooltip) return btn;
                return (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>{btn}</TooltipTrigger>
                    <TooltipContent side="bottom">{item.tooltip}</TooltipContent>
                  </Tooltip>
                );
              })}
              </TooltipProvider>
            </>
          )}
        </div>

        {active && isActivePdf && (
          <button
            type="button"
            onClick={() => setPdfToolbarOpen((v) => !v)}
            aria-label={pdfToolbarOpen ? "Hide PDF toolbar" : "Show PDF toolbar"}
            title={pdfToolbarOpen ? "Hide PDF toolbar" : "Show PDF toolbar"}
            className="flex h-[23px] shrink-0 items-center gap-1 rounded-md border px-2 text-xs opacity-70 transition-colors hover:brightness-125"
            style={{
              backgroundColor: "var(--eyeframe-card)",
              borderColor: pdfToolbarOpen ? "var(--eyeframe-accent)" : "var(--eyeframe-border)",
              color: "var(--eyeframe-text)",
            }}
          >
            {pdfToolbarOpen ? <PanelTopClose className="h-3 w-3" /> : <PanelTopOpen className="h-3 w-3" />}
            <span>{pdfToolbarOpen ? "Hide Toolbar" : "PDF Toolbar"}</span>
          </button>
        )}

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
        {isGalleryCat && currentCat ? (
          <GalleryView category={currentCat} galleries={galleries} items={galleryItems} />
        ) : !active && (
          (data?.idleImages?.length ?? 0) > 0 ? (
            <IdleCarousel images={data!.idleImages!} />
          ) : labels.idle_image_url ? (
            <div className="relative flex h-full w-full flex-col items-center justify-center gap-4" style={{ backgroundColor: "var(--eyeframe-bg)" }}>
              <img
                src={labels.idle_image_url}
                alt={labels.kiosk_title}
                className="max-h-[66%] max-w-[66%] object-contain"
              />
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


        {active && isActiveVideo && (
          <video
            key={active.id}
            src={active.url}
            controls
            autoPlay
            playsInline
            className="h-full w-full bg-black object-contain"
          />
        )}

        {active && !isActiveVideo && isActivePdf && (
          <ClientOnly fallback={<div className="flex h-full w-full items-center justify-center text-sm opacity-70">Loading PDF viewer…</div>}>
            <Suspense fallback={<div className="flex h-full w-full items-center justify-center text-sm opacity-70">Loading PDF viewer…</div>}>
              <PdfViewer url={active.url} label={active.label} storagePath={active.pdf_storage_path} showToolbar={pdfToolbarOpen} />
            </Suspense>
          </ClientOnly>
        )}

        {active && !isActiveVideo && !isActivePdf && (
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
                    <CategoryIcon iconName={findCat(active.category)?.icon} className="h-10 w-10" />
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

function IdleCarousel({ images }: { images: IdleImage[] }) {
  const showControls = images.length > 1;
  return (
    <div className="absolute inset-0">
      <Carousel className="h-full w-full" opts={{ loop: true }}>
        <CarouselContent className="-ml-0 h-full" style={{ height: "100%" }}>
          {images.map((img) => (
            <CarouselItem key={img.id} className="basis-full pl-0">
              <div
                className="flex h-full w-full flex-col items-center justify-center gap-4"
                style={{ height: "95.4vh" }}
              >
                <img
                  src={img.image_url}
                  alt={img.caption ?? ""}
                  className="max-h-[80%] max-w-[85%] object-contain"
                />
                {img.caption && (
                  <div className="text-center text-3xl font-semibold leading-tight opacity-90">
                    {img.caption}
                  </div>
                )}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {showControls && (
          <>
            <CarouselPrevious
              className="left-6 top-1/2 h-14 w-14 -translate-y-1/2 border-0"
              style={{
                backgroundColor: "color-mix(in oklab, var(--eyeframe-accent) 80%, transparent)",
                color: "var(--eyeframe-bg)",
              }}
            />
            <CarouselNext
              className="right-6 top-1/2 h-14 w-14 -translate-y-1/2 border-0"
              style={{
                backgroundColor: "color-mix(in oklab, var(--eyeframe-accent) 80%, transparent)",
                color: "var(--eyeframe-bg)",
              }}
            />
          </>
        )}
      </Carousel>
    </div>
  );
}


