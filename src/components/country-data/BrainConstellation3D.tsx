import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Billboard, Environment, Html, Line, OrbitControls } from "@react-three/drei";
import { Bloom, DepthOfField, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Plus, Minus, RotateCcw, Pause, Play } from "lucide-react";
import * as THREE from "three";

import { CARICOM_OECS_REGISTRY } from "@/lib/caricom-registry";
import type { BrainFilter, BrainRow } from "./BrainConstellation";

const COUNTRY_NAME: Record<string, string> = CARICOM_OECS_REGISTRY.reduce(
  (acc, n) => {
    acc[n.code] = n.name;
    return acc;
  },
  {} as Record<string, string>,
);

const SECTOR_HUES = [
  "#7c9dff", "#4ec9a5", "#e0a656", "#e17b7b", "#8fb2e0", "#a6c96b",
  "#e08a56", "#5faaa2", "#a89cff", "#c98ab8", "#c9a56b", "#c0c8d4",
];

function hash01(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}

function sectorLabel(code: string) {
  if (!code || code === "—") return "Unclassified";
  return code
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function countryLabel(code: string) {
  return COUNTRY_NAME[code] ?? code;
}

// Radial-gradient halo texture, generated once.
function useHaloTexture() {
  return useMemo(() => {
    const size = 128;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d")!;
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.25, "rgba(255,255,255,0.55)");
    grad.addColorStop(0.55, "rgba(255,255,255,0.15)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

type Props = {
  rows: BrainRow[];
  mode: "single" | "system";
  centerLabel: string;
  filter: BrainFilter;
  onFilter: (f: BrainFilter) => void;
  onSelectCountry?: (code: string) => void;
};

type FocusTarget =
  | { kind: "country"; code: string }
  | { kind: "sector"; code: string }
  | null;

export function BrainConstellation3D(props: Props) {
  const [zoomStep, setZoomStep] = useState(0); // -3..+3 (0 = 100% = auto-fit)
  const [paused, setPaused] = useState(false);
  const [focus, setFocus] = useState<FocusTarget>(null);
  const [resetKey, setResetKey] = useState(0);

  const zoomIn = () => setZoomStep((z) => Math.min(3, z + 1));
  const zoomOut = () => setZoomStep((z) => Math.max(-3, z - 1));
  const zoomPct = Math.round(100 * Math.pow(1.2, zoomStep));

  // Keyboard shortcuts
  const wrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.code === "Escape") {
        setFocus(null);
      }
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      ref={wrapperRef}
      tabIndex={0}
      className="relative w-full h-[min(78vh,900px)] border border-line-200 bg-black overflow-hidden outline-none"
    >
      <Canvas
        key={resetKey}
        dpr={[1, 2]}
        camera={{ position: [0, 0, 18], fov: 42, near: 0.1, far: 200 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        onPointerMissed={() => setPaused((p) => !p)}
      >
        <Suspense fallback={null}>
          <Scene
            {...props}
            zoomStep={zoomStep}
            paused={paused}
            focus={focus}
            onFocus={setFocus}
          />
        </Suspense>
      </Canvas>

      {/* Top-right: reset */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
        <button
          onClick={() => {
            setResetKey((k) => k + 1);
            setFocus(null);
            setZoomStep(0);
            setPaused(false);
          }}
          className="grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-black/70 text-white/80 backdrop-blur hover:text-white"
          title="Reset view"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Bottom-right controls: pause + zoom */}
      <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2">
        <button
          onClick={() => setPaused((p) => !p)}
          className="grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-black/70 text-white/80 backdrop-blur hover:text-white"
          title={paused ? "Resume" : "Pause"}
        >
          {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
        </button>
        <div className="flex items-center gap-1 rounded-full border border-white/20 bg-black/70 p-0.5 backdrop-blur">
          <button
            onClick={zoomOut}
            className="grid h-7 w-7 place-items-center rounded-full text-white/70 hover:text-white"
            title="Zoom out"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[4ch] text-center font-mono text-[10px] uppercase tracking-widest text-white/70">
            {zoomPct}%
          </span>
          <button
            onClick={zoomIn}
            className="grid h-7 w-7 place-items-center rounded-full text-white/70 hover:text-white"
            title="Zoom in"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 z-10 font-mono text-[10px] uppercase tracking-widest text-white/40">
        {props.centerLabel} · living constellation {paused && "· paused"}
      </div>
    </div>
  );
}

function Scene({
  rows,
  centerLabel,
  filter,
  onFilter,
  onSelectCountry,
  zoomStep,
  paused,
  focus,
  onFocus,
}: Props & {
  zoomStep: number;
  paused: boolean;
  focus: FocusTarget;
  onFocus: (f: FocusTarget) => void;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const halo = useHaloTexture();

  // ---- aggregate ----
  const { countries, sectors } = useMemo(() => {
    const byCountry = new Map<string, BrainRow[]>();
    const bySector = new Map<string, BrainRow[]>();
    const now = Date.now();
    for (const r of rows) {
      const c = r.scope_key || "—";
      if (!byCountry.has(c)) byCountry.set(c, []);
      byCountry.get(c)!.push(r);
      const s = r.sector_code || "—";
      if (!bySector.has(s)) bySector.set(s, []);
      bySector.get(s)!.push(r);
    }
    return {
      countries: Array.from(byCountry.entries()).map(([code, rs]) => ({
        code,
        count: rs.length,
        verified: rs.filter((r) => r.verified).length / Math.max(1, rs.length),
        recent: rs.filter((r) => now - new Date(r.updated_at).getTime() < 86400_000).length,
      })),
      sectors: Array.from(bySector.entries()).map(([code, rs]) => ({
        code,
        count: rs.length,
        recent: rs.filter((r) => now - new Date(r.updated_at).getTime() < 86400_000).length,
      })),
    };
  }, [rows]);

  // Fibonacci sphere for countries
  const countryPositions = useMemo(() => {
    const R = 7.5;
    const n = countries.length;
    const golden = Math.PI * (3 - Math.sqrt(5));
    return countries.map((c, i) => {
      const y = 1 - (i / Math.max(1, n - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = golden * i;
      return {
        ...c,
        anchor: new THREE.Vector3(Math.cos(theta) * r * R, y * R, Math.sin(theta) * r * R),
        seed: hash01(c.code),
      };
    });
  }, [countries]);

  const sectorPositions = useMemo(() => {
    const R = 3.8;
    return sectors.map((s, i) => {
      const angle = (i / Math.max(1, sectors.length)) * Math.PI * 2 + hash01(s.code) * 0.5;
      const tilt = 0.35;
      const pos = new THREE.Vector3(
        Math.cos(angle) * R,
        Math.sin(angle) * R * tilt + (hash01(s.code + "y") - 0.5) * 0.9,
        Math.sin(angle) * R * 0.9,
      );
      const hueIdx = Math.floor(hash01(s.code) * SECTOR_HUES.length);
      return { ...s, anchor: pos, color: SECTOR_HUES[hueIdx], seed: hash01(s.code) };
    });
  }, [sectors]);

  // Auto-fit + zoom
  const fitDistance = useMemo(() => {
    const pts = [
      new THREE.Vector3(0, 0, 0),
      ...countryPositions.map((c) => c.anchor),
      ...sectorPositions.map((s) => s.anchor),
    ];
    const box = new THREE.Box3().setFromPoints(pts);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const fov = (42 * Math.PI) / 180;
    return (sphere.radius * 1.35) / Math.sin(fov / 2);
  }, [countryPositions, sectorPositions]);

  // Camera glide (auto-fit + zoom + focus)
  useFrame(() => {
    const target = new THREE.Vector3(0, 0, 0);
    let distance = fitDistance / Math.pow(1.2, zoomStep);

    if (focus) {
      const anchor =
        focus.kind === "country"
          ? countryPositions.find((c) => c.code === focus.code)?.anchor
          : sectorPositions.find((s) => s.code === focus.code)?.anchor;
      if (anchor) {
        target.copy(anchor);
        distance = 4.5 / Math.pow(1.2, zoomStep);
      }
    }

    if (controlsRef.current) {
      controlsRef.current.target.lerp(target, 0.06);
      controlsRef.current.update();
    }
    const dir = camera.position.clone().sub(controlsRef.current?.target ?? target).normalize();
    if (dir.lengthSq() < 0.01) dir.set(0, 0.2, 1).normalize();
    const desired = (controlsRef.current?.target ?? target).clone().add(dir.multiplyScalar(distance));
    camera.position.lerp(desired, 0.05);
  });

  // Focused neighbor set (for label reveal)
  const focusedCode = focus?.code ?? null;
  const isNeighbor = useCallback(
    (kind: "country" | "sector", code: string) => {
      if (!focus) return false;
      if (focus.kind === kind && focus.code === code) return true;
      // A country is "neighbor" of any focused sector, and vice versa.
      return focus.kind !== kind;
    },
    [focus],
  );

  const [hovered, setHovered] = useState<string | null>(null);

  const dimmedThread = focus ? 0.08 : 0.28;
  const activeThread = focus ? 0.85 : 0.55;

  return (
    <>
      <color attach="background" args={["#000000"]} />
      <fog attach="fog" args={["#000000", 18, 60]} />

      {/* Lights */}
      <ambientLight intensity={0.35} />
      <pointLight position={[6, 8, 6]} intensity={1.6} color="#ffd9a3" />
      <pointLight position={[-8, -4, -6]} intensity={0.9} color="#7ea3ff" />
      <pointLight position={[0, 0, 10]} intensity={0.4} color="#ffffff" />
      <Environment preset="night" />

      <Core
        label={centerLabel}
        halo={halo}
        paused={paused}
        selected={focus === null}
      />

      <StarDust count={500} paused={paused} />

      {/* Sector threads */}
      {sectorPositions.map((s) => {
        const active = focus ? focus.kind === "sector" && focus.code === s.code : s.recent > 0;
        return (
          <ThreadLine
            key={`th-s-${s.code}`}
            from={new THREE.Vector3(0, 0, 0)}
            to={s.anchor}
            color={s.color}
            opacity={active ? activeThread : dimmedThread}
            seed={s.seed}
            paused={paused}
          />
        );
      })}

      {/* Country threads */}
      {countryPositions.map((c) => {
        const active = focus ? focus.kind === "country" && focus.code === c.code : c.recent > 0;
        return (
          <ThreadLine
            key={`th-c-${c.code}`}
            from={new THREE.Vector3(0, 0, 0)}
            to={c.anchor}
            color={c.recent > 0 ? "#d9b866" : "#6f88b8"}
            opacity={active ? activeThread : dimmedThread}
            seed={c.seed}
            paused={paused}
          />
        );
      })}

      {sectorPositions.map((s) => {
        const isFocused = focus?.kind === "sector" && focus.code === s.code;
        const showLabel = hovered === `s:${s.code}` || isFocused || isNeighbor("sector", s.code);
        return (
          <OrbNode
            key={`s-${s.code}`}
            anchor={s.anchor}
            seed={s.seed}
            color={s.color}
            haloTex={halo}
            size={0.13 + Math.min(0.14, s.count * 0.006)}
            haloScale={0.9}
            label={sectorLabel(s.code)}
            showLabel={showLabel}
            focused={isFocused}
            dimmed={!!focus && !isFocused && !isNeighbor("sector", s.code)}
            paused={paused}
            onHover={(h) => setHovered(h ? `s:${s.code}` : null)}
            onClick={() => {
              if (focus?.kind === "sector" && focus.code === s.code) {
                onFocus(null);
                onFilter({ ...filter, sector: undefined });
              } else {
                onFocus({ kind: "sector", code: s.code });
                onFilter({ ...filter, sector: s.code });
              }
            }}
          />
        );
      })}

      {countryPositions.map((c) => {
        const isFocused = focus?.kind === "country" && focus.code === c.code;
        const showLabel = hovered === `c:${c.code}` || isFocused || isNeighbor("country", c.code);
        return (
          <OrbNode
            key={`c-${c.code}`}
            anchor={c.anchor}
            seed={c.seed}
            color={c.recent > 0 ? "#d9b866" : "#ffffff"}
            coreColor="#f4f4ef"
            haloTex={halo}
            size={0.11 + Math.min(0.14, c.count * 0.004)}
            haloScale={0.85}
            label={countryLabel(c.code)}
            showLabel={showLabel}
            focused={isFocused}
            dimmed={!!focus && !isFocused && !isNeighbor("country", c.code)}
            paused={paused}
            onHover={(h) => setHovered(h ? `c:${c.code}` : null)}
            onClick={() => {
              if (focus?.kind === "country" && focus.code === c.code) {
                onFocus(null);
              } else {
                onFocus({ kind: "country", code: c.code });
                onSelectCountry?.(c.code);
              }
            }}
          />
        );
      })}

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom={false}
        enableDamping
        dampingFactor={0.08}
        autoRotate={!paused && !focus}
        autoRotateSpeed={0.3}
        minPolarAngle={Math.PI * 0.15}
        maxPolarAngle={Math.PI * 0.85}
      />

      <EffectComposer>
        <Bloom intensity={0.75} luminanceThreshold={0.55} luminanceSmoothing={0.4} mipmapBlur />
        <DepthOfField focusDistance={0.012} focalLength={0.035} bokehScale={1.6} />
        <Vignette eskil={false} offset={0.25} darkness={0.75} />
      </EffectComposer>
    </>
  );
}

// ---------------- Core (GDPVISION) ----------------
function Core({
  label,
  halo,
  paused,
  selected,
}: {
  label: string;
  halo: THREE.Texture;
  paused: boolean;
  selected: boolean;
}) {
  const inner = useRef<THREE.Mesh>(null);
  const outer = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (paused) return;
    const t = clock.getElapsedTime();
    const s = 1 + Math.sin(t * 1.6) * 0.06;
    if (inner.current) inner.current.scale.setScalar(s);
    if (outer.current) {
      outer.current.rotation.y += 0.002;
      outer.current.rotation.x += 0.0012;
      outer.current.scale.setScalar(1.4 + Math.sin(t * 1.2) * 0.05);
    }
    if (light.current) light.current.intensity = 2.2 + Math.sin(t * 1.6) * 0.8;
  });
  return (
    <group>
      <mesh ref={inner}>
        <icosahedronGeometry args={[0.7, 3]} />
        <meshPhysicalMaterial
          color="#1a1207"
          emissive="#e8b048"
          emissiveIntensity={1.4}
          metalness={0.8}
          roughness={0.2}
          clearcoat={1}
          clearcoatRoughness={0.1}
        />
      </mesh>
      <mesh ref={outer}>
        <icosahedronGeometry args={[0.9, 1]} />
        <meshBasicMaterial color="#d9b866" wireframe transparent opacity={0.28} />
      </mesh>
      <Billboard>
        <mesh>
          <planeGeometry args={[3.2, 3.2]} />
          <meshBasicMaterial
            map={halo}
            color="#e8b048"
            transparent
            opacity={0.55}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </Billboard>
      <pointLight ref={light} intensity={2.5} color="#e8b048" distance={14} />
      <Html position={[0, -1.4, 0]} center distanceFactor={10} zIndexRange={[10, 0]} occlude={false}>
        <div
          className="pointer-events-none select-none whitespace-nowrap rounded-full bg-black/85 px-3 py-1 text-[13px] font-medium tracking-[0.18em] uppercase text-white shadow-[0_0_20px_rgba(0,0,0,0.8)]"
          style={{
            border: "1px solid #d9b866",
            boxShadow: "0 0 24px rgba(217,184,102,0.35)",
            opacity: selected ? 1 : 0.85,
          }}
        >
          {label}
        </div>
      </Html>
    </group>
  );
}

// ---------------- Orb node ----------------
function OrbNode({
  anchor,
  seed,
  color,
  coreColor,
  haloTex,
  size,
  haloScale,
  label,
  showLabel,
  focused,
  dimmed,
  paused,
  onHover,
  onClick,
}: {
  anchor: THREE.Vector3;
  seed: number;
  color: string;
  coreColor?: string;
  haloTex: THREE.Texture;
  size: number;
  haloScale: number;
  label: string;
  showLabel: boolean;
  focused: boolean;
  dimmed: boolean;
  paused: boolean;
  onHover: (h: boolean) => void;
  onClick: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (paused) return;
    const t = clock.getElapsedTime();
    if (group.current) {
      const wob = 0.28 + seed * 0.2;
      const phase = seed * Math.PI * 2;
      group.current.position.set(
        anchor.x + Math.cos(t * (0.22 + seed * 0.2) + phase) * wob,
        anchor.y + Math.sin(t * (0.28 + seed * 0.15) + phase) * wob * 0.7,
        anchor.z + Math.cos(t * (0.2 + seed * 0.2) + phase) * wob,
      );
    }
    if (meshRef.current) {
      const s = 1 + Math.sin(t * 2 + seed * 10) * 0.05;
      meshRef.current.scale.setScalar(s * (focused ? 1.5 : 1));
    }
  });

  const opacity = dimmed ? 0.25 : 1;
  const haloOpacity = dimmed ? 0.1 : focused ? 0.85 : 0.4;

  return (
    <group ref={group}>
      {/* Core sphere (PBR, gives specular hotspot) */}
      <mesh
        ref={meshRef}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          onHover(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          onHover(false);
          document.body.style.cursor = "auto";
        }}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <sphereGeometry args={[size, 48, 48]} />
        <meshPhysicalMaterial
          color={coreColor ?? color}
          emissive={color}
          emissiveIntensity={focused ? 1.1 : 0.35}
          metalness={0.65}
          roughness={0.22}
          clearcoat={1}
          clearcoatRoughness={0.1}
          transparent
          opacity={opacity}
        />
      </mesh>
      {/* Halo sprite */}
      <Billboard>
        <mesh scale={[haloScale, haloScale, 1]}>
          <planeGeometry args={[1.1, 1.1]} />
          <meshBasicMaterial
            map={haloTex}
            color={color}
            transparent
            opacity={haloOpacity}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </Billboard>
      {/* Pill label */}
      {showLabel && (
        <Html position={[0, -size - 0.35, 0]} center distanceFactor={9} zIndexRange={[10, 0]} occlude={false}>
          <div
            className="pointer-events-none select-none whitespace-nowrap rounded-full bg-black/85 px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-white shadow-[0_0_12px_rgba(0,0,0,0.7)]"
            style={{
              border: `1px solid ${color}`,
              boxShadow: `0 0 14px ${color}55`,
            }}
          >
            {label}
          </div>
        </Html>
      )}
    </group>
  );
}

// ---------------- Thread line ----------------
function ThreadLine({
  from,
  to,
  color,
  opacity,
  seed,
  paused,
}: {
  from: THREE.Vector3;
  to: THREE.Vector3;
  color: string;
  opacity: number;
  seed: number;
  paused: boolean;
}) {
  const curve = useMemo(() => {
    const mid = from.clone().lerp(to, 0.5);
    const normal = new THREE.Vector3(
      (seed - 0.5) * 2,
      (hash01(String(seed) + "n") - 0.5) * 2,
      (hash01(String(seed) + "b") - 0.5) * 2,
    ).normalize().multiplyScalar(to.length() * 0.18);
    mid.add(normal);
    return new THREE.QuadraticBezierCurve3(from.clone(), mid, to.clone());
  }, [from, to, seed]);

  const points = useMemo(() => curve.getPoints(48), [curve]);

  const dotsRef = useRef<THREE.Group>(null);
  const dots = [0, 1, 2];
  useFrame(({ clock }) => {
    if (paused || !dotsRef.current) return;
    const t = clock.getElapsedTime();
    dotsRef.current.children.forEach((child, i) => {
      const offset = (i / dots.length + t * (0.14 + seed * 0.08)) % 1;
      const p = curve.getPoint(offset);
      child.position.copy(p);
      const scale = 0.6 + Math.sin(offset * Math.PI) * 1.1;
      (child as THREE.Mesh).scale.setScalar(scale);
    });
  });

  return (
    <group>
      <Line points={points} color={color} lineWidth={1} transparent opacity={opacity} />
      <group ref={dotsRef}>
        {dots.map((i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.028, 10, 10]} />
            <meshBasicMaterial color={color} transparent opacity={Math.min(1, opacity + 0.3)} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ---------------- Starfield ----------------
function StarDust({ count, paused }: { count: number; paused: boolean }) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 18 + Math.random() * 20;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [count]);
  const ref = useRef<THREE.Points>(null);
  useFrame(({ clock }) => {
    if (paused) return;
    if (ref.current) ref.current.rotation.y = clock.getElapsedTime() * 0.01;
  });
  return (
    <points ref={ref} geometry={geom}>
      <pointsMaterial size={0.03} color="#ffffff" transparent opacity={0.75} sizeAttenuation={false} />
    </points>
  );
}
