import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Billboard, Html, OrbitControls, Text } from "@react-three/drei";
import { Bloom, DepthOfField, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Plus, Minus, RotateCcw } from "lucide-react";
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
  "#1e3350", "#2e7d5b", "#b98a2f", "#8e2f3c", "#4a6b8a", "#6f8a3a",
  "#a86a2f", "#3f6f6b", "#5b4fa8", "#7a4a6b", "#8a6d3a", "#9daec2",
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

type Props = {
  rows: BrainRow[];
  mode: "single" | "system";
  centerLabel: string;
  filter: BrainFilter;
  onFilter: (f: BrainFilter) => void;
  onSelectCountry?: (code: string) => void;
};

export function BrainConstellation3D(props: Props) {
  const [dolly, setDolly] = useState(14);
  const [resetKey, setResetKey] = useState(0);
  const zoomIn = () => setDolly((d) => Math.max(6, d - 2));
  const zoomOut = () => setDolly((d) => Math.min(24, d + 2));

  return (
    <div className="relative w-full aspect-square max-h-[820px] border border-line-200 bg-[#05080f] overflow-hidden">
      <Canvas
        key={resetKey}
        dpr={[1, 2]}
        camera={{ position: [0, 0, dolly], fov: 45, near: 0.1, far: 200 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <Suspense fallback={null}>
          <Scene {...props} dolly={dolly} />
        </Suspense>
      </Canvas>

      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
        <button
          onClick={() => setResetKey((k) => k + 1)}
          className="grid h-8 w-8 place-items-center border border-white/20 bg-black/40 text-white/70 backdrop-blur hover:text-white"
          title="Reset view"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1 border border-white/20 bg-black/40 p-0.5 backdrop-blur">
        <button
          onClick={zoomOut}
          className="grid h-7 w-7 place-items-center text-white/70 hover:text-white"
          title="Zoom out"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-[3ch] text-center font-mono text-[10px] uppercase tracking-widest text-white/60">
          {Math.round((14 / dolly) * 100)}%
        </span>
        <button
          onClick={zoomIn}
          className="grid h-7 w-7 place-items-center text-white/70 hover:text-white"
          title="Zoom in"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 z-10 font-mono text-[10px] uppercase tracking-widest text-white/40">
        {props.centerLabel} · living constellation
      </div>
    </div>
  );
}

function Scene({
  rows,
  mode,
  centerLabel,
  filter,
  onFilter,
  onSelectCountry,
  dolly,
}: Props & { dolly: number }) {
  const { camera } = useThree();
  const controls = useRef<any>(null);

  // Dolly camera when zoom control changes
  useEffect(() => {
    const target = new THREE.Vector3(0, 0, dolly);
    let raf = 0;
    const tick = () => {
      camera.position.lerp(target, 0.15);
      if (camera.position.distanceTo(target) > 0.02) {
        raf = requestAnimationFrame(tick);
      }
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [dolly, camera]);

  // ---- aggregate ----
  const { countries, sectors, now } = useMemo(() => {
    const byCountry = new Map<string, BrainRow[]>();
    const bySector = new Map<string, BrainRow[]>();
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
        recent: rs.filter((r) => Date.now() - new Date(r.updated_at).getTime() < 86400_000).length,
      })),
      sectors: Array.from(bySector.entries()).map(([code, rs]) => ({
        code,
        count: rs.length,
        recent: rs.filter((r) => Date.now() - new Date(r.updated_at).getTime() < 86400_000).length,
      })),
      now: Date.now(),
    };
  }, [rows]);

  // Fibonacci sphere for countries
  const countryPositions = useMemo(() => {
    const R = 8;
    const n = countries.length;
    const golden = Math.PI * (3 - Math.sqrt(5));
    return countries.map((c, i) => {
      const y = 1 - (i / Math.max(1, n - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = golden * i;
      const jitter = hash01(c.code);
      return {
        ...c,
        anchor: new THREE.Vector3(Math.cos(theta) * r * R, y * R, Math.sin(theta) * r * R),
        seed: jitter,
      };
    });
  }, [countries]);

  // Sectors on tilted torus
  const sectorPositions = useMemo(() => {
    const R = 4.5;
    return sectors.map((s, i) => {
      const angle = (i / Math.max(1, sectors.length)) * Math.PI * 2 + hash01(s.code) * 0.4;
      const tilt = 0.35;
      const pos = new THREE.Vector3(
        Math.cos(angle) * R,
        Math.sin(angle) * R * tilt + (hash01(s.code + "y") - 0.5) * 0.8,
        Math.sin(angle) * R * 0.9,
      );
      const hueIdx = Math.floor(hash01(s.code) * SECTOR_HUES.length);
      return { ...s, anchor: pos, color: SECTOR_HUES[hueIdx], angle };
    });
  }, [sectors]);

  const [hovered, setHovered] = useState<{ label: string; sub?: string } | null>(null);

  return (
    <>
      <color attach="background" args={["#05080f"]} />
      <fog attach="fog" args={["#05080f", 18, 40]} />

      <ambientLight intensity={0.25} />
      <pointLight position={[0, 0, 0]} intensity={2.5} color="#d9b866" distance={20} />
      <pointLight position={[10, 8, 10]} intensity={0.6} color="#5b8bff" />
      <pointLight position={[-10, -6, -8]} intensity={0.4} color="#b98a2f" />

      <Core label={centerLabel} />

      {/* Ambient star dust */}
      <StarDust count={400} />

      {/* Sector threads (core -> sector) */}
      {sectorPositions.map((s) => (
        <Thread
          key={`th-s-${s.code}`}
          from={new THREE.Vector3(0, 0, 0)}
          to={s.anchor}
          color={s.color}
          active={s.recent > 0}
          seed={hash01(s.code)}
        />
      ))}

      {/* Country threads (core -> country) */}
      {countryPositions.map((c) => (
        <Thread
          key={`th-c-${c.code}`}
          from={new THREE.Vector3(0, 0, 0)}
          to={c.anchor}
          color="#6f88b8"
          active={c.recent > 0}
          seed={c.seed}
        />
      ))}

      {sectorPositions.map((s) => (
        <SectorNode
          key={`s-${s.code}`}
          anchor={s.anchor}
          color={s.color}
          label={sectorLabel(s.code)}
          count={s.count}
          onHover={(h) => setHovered(h ? { label: sectorLabel(s.code), sub: `${s.count} memories` } : null)}
          onClick={() => onFilter({ ...filter, sector: filter.sector === s.code ? undefined : s.code })}
          selected={filter.sector === s.code}
        />
      ))}

      {countryPositions.map((c) => (
        <CountryNode
          key={`c-${c.code}`}
          anchor={c.anchor}
          seed={c.seed}
          count={c.count}
          verified={c.verified}
          recent={c.recent > 0}
          label={countryLabel(c.code)}
          selected={filter.country === c.code}
          onHover={(h) => setHovered(h ? { label: countryLabel(c.code), sub: `${c.count} memories` } : null)}
          onClick={() => onSelectCountry?.(c.code)}
        />
      ))}

      {hovered && (
        <Html position={[0, -7.2, 0]} center style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap border border-white/20 bg-black/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-white/90 backdrop-blur">
            {hovered.label}
            {hovered.sub ? <span className="ml-2 text-white/50">{hovered.sub}</span> : null}
          </div>
        </Html>
      )}

      <OrbitControls
        ref={controls}
        enablePan={false}
        enableZoom={false}
        enableDamping
        dampingFactor={0.08}
        autoRotate
        autoRotateSpeed={0.35}
        minPolarAngle={Math.PI * 0.2}
        maxPolarAngle={Math.PI * 0.8}
      />

      <EffectComposer>
        <Bloom intensity={0.9} luminanceThreshold={0.18} luminanceSmoothing={0.5} mipmapBlur />
        <DepthOfField focusDistance={0.012} focalLength={0.04} bokehScale={2.6} />
        <Vignette eskil={false} offset={0.2} darkness={0.7} />
      </EffectComposer>
    </>
  );
}

function Core({ label }: { label: string }) {
  const inner = useRef<THREE.Mesh>(null);
  const outer = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const s = 1 + Math.sin(t * 1.6) * 0.06;
    if (inner.current) inner.current.scale.setScalar(s);
    if (outer.current) {
      outer.current.rotation.y += 0.002;
      outer.current.rotation.x += 0.0012;
      outer.current.scale.setScalar(1.35 + Math.sin(t * 1.2) * 0.04);
    }
    if (light.current) light.current.intensity = 2.2 + Math.sin(t * 1.6) * 0.8;
  });
  return (
    <group>
      <mesh ref={inner}>
        <icosahedronGeometry args={[0.9, 2]} />
        <meshStandardMaterial
          color="#0d1b2e"
          emissive="#d9b866"
          emissiveIntensity={1.6}
          metalness={0.6}
          roughness={0.25}
        />
      </mesh>
      <mesh ref={outer}>
        <icosahedronGeometry args={[1.1, 1]} />
        <meshBasicMaterial color="#b98a2f" wireframe transparent opacity={0.35} />
      </mesh>
      <pointLight ref={light} intensity={2.5} color="#d9b866" distance={12} />
      <Billboard>
        <Text
          position={[0, -1.9, 0]}
          fontSize={0.28}
          color="#f4f4ef"
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.15}
        >
          {label}
        </Text>
      </Billboard>
    </group>
  );
}

function SectorNode({
  anchor,
  color,
  label,
  count,
  selected,
  onHover,
  onClick,
}: {
  anchor: THREE.Vector3;
  color: string;
  label: string;
  count: number;
  selected: boolean;
  onHover: (h: boolean) => void;
  onClick: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const size = 0.18 + Math.min(0.35, count * 0.01);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (group.current) {
      // slow orbital drift around its anchor
      const wob = 0.25;
      group.current.position.set(
        anchor.x + Math.cos(t * 0.3 + anchor.x) * wob,
        anchor.y + Math.sin(t * 0.4 + anchor.y) * wob,
        anchor.z + Math.cos(t * 0.35 + anchor.z) * wob,
      );
    }
    if (mesh.current) {
      const s = 1 + Math.sin(t * 2 + anchor.x) * 0.05;
      mesh.current.scale.setScalar(s * (selected ? 1.4 : 1));
    }
  });
  return (
    <group ref={group}>
      <mesh
        ref={mesh}
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
        <sphereGeometry args={[size, 24, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={selected ? 1.8 : 0.9}
          roughness={0.35}
          metalness={0.4}
        />
      </mesh>
      <Billboard>
        <Text
          position={[0, -size - 0.22, 0]}
          fontSize={0.14}
          color="#e3e4dd"
          anchorX="center"
          anchorY="middle"
        >
          {label}
        </Text>
      </Billboard>
    </group>
  );
}

function CountryNode({
  anchor,
  seed,
  count,
  verified,
  recent,
  label,
  selected,
  onHover,
  onClick,
}: {
  anchor: THREE.Vector3;
  seed: number;
  count: number;
  verified: number;
  recent: boolean;
  label: string;
  selected: boolean;
  onHover: (h: boolean) => void;
  onClick: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const size = 0.14 + Math.min(0.32, count * 0.006);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (group.current) {
      const wob = 0.35 + seed * 0.2;
      const phase = seed * Math.PI * 2;
      group.current.position.set(
        anchor.x + Math.cos(t * (0.25 + seed * 0.2) + phase) * wob,
        anchor.y + Math.sin(t * (0.3 + seed * 0.15) + phase) * wob,
        anchor.z + Math.cos(t * (0.22 + seed * 0.2) + phase) * wob,
      );
    }
    if (mesh.current) {
      const s = 1 + Math.sin(t * 2.2 + seed * 10) * 0.06;
      mesh.current.scale.setScalar(s * (selected ? 1.5 : 1));
    }
  });
  const emissive = recent ? "#d9b866" : "#f4f4ef";
  return (
    <group ref={group}>
      <mesh
        ref={mesh}
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
        <sphereGeometry args={[size, 24, 24]} />
        <meshStandardMaterial
          color="#f4f4ef"
          emissive={emissive}
          emissiveIntensity={0.4 + verified * 0.9}
          roughness={0.3}
          metalness={0.2}
        />
      </mesh>
      <Billboard>
        <Text
          position={[0, -size - 0.2, 0]}
          fontSize={0.13}
          color="#e3e4dd"
          anchorX="center"
          anchorY="middle"
          maxWidth={3}
        >
          {label}
        </Text>
      </Billboard>
    </group>
  );
}

function Thread({
  from,
  to,
  color,
  active,
  seed,
}: {
  from: THREE.Vector3;
  to: THREE.Vector3;
  color: string;
  active: boolean;
  seed: number;
}) {
  const curve = useMemo(() => {
    const mid = from.clone().lerp(to, 0.5);
    const normal = new THREE.Vector3(
      (seed - 0.5) * 2,
      (hash01(String(seed) + "n") - 0.5) * 2,
      (hash01(String(seed) + "b") - 0.5) * 2,
    ).normalize().multiplyScalar(to.length() * 0.22);
    mid.add(normal);
    return new THREE.QuadraticBezierCurve3(from.clone(), mid, to.clone());
  }, [from, to, seed]);

  const tubeGeom = useMemo(() => new THREE.TubeGeometry(curve, 32, 0.008, 6, false), [curve]);

  // 3 dots per thread
  const dotsRef = useRef<THREE.Group>(null);
  const dots = [0, 1, 2];
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (!dotsRef.current) return;
    dotsRef.current.children.forEach((child, i) => {
      const offset = (i / dots.length + t * (0.15 + seed * 0.1)) % 1;
      const p = curve.getPoint(offset);
      child.position.copy(p);
      const scale = 0.5 + Math.sin(offset * Math.PI) * 1.2;
      (child as THREE.Mesh).scale.setScalar(scale);
    });
  });

  const dotColor = active ? "#d9b866" : color;

  return (
    <group>
      <mesh geometry={tubeGeom}>
        <meshBasicMaterial color={color} transparent opacity={active ? 0.45 : 0.2} />
      </mesh>
      <group ref={dotsRef}>
        {dots.map((i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.035, 10, 10]} />
            <meshBasicMaterial color={dotColor} transparent opacity={0.95} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function StarDust({ count }: { count: number }) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 14 + Math.random() * 12;
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
    if (ref.current) ref.current.rotation.y = clock.getElapsedTime() * 0.02;
  });
  return (
    <points ref={ref} geometry={geom}>
      <pointsMaterial size={0.04} color="#8aa0c0" transparent opacity={0.6} sizeAttenuation />
    </points>
  );
}
