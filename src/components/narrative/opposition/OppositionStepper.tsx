import { Upload, Brain, Sparkles, Send, Check, Loader2 } from "lucide-react";

export type StepStatus = "idle" | "active" | "done" | "failed";

export interface StepperState {
  capture: StepStatus;
  analyze: StepStatus;
  plan: StepStatus;
  publish: StepStatus;
}

const STEPS: Array<{
  key: keyof StepperState;
  n: string;
  label: string;
  hint: string;
  Icon: typeof Upload;
}> = [
  { key: "capture", n: "01", label: "Capture", hint: "Drop memes, screenshots, links or forwarded text.", Icon: Upload },
  { key: "analyze", n: "02", label: "Analyze", hint: "AI extracts motivation, origin and amplification.", Icon: Brain },
  { key: "plan", n: "03", label: "Counter-campaign", hint: "McKinsey-grade response plan, auto-drafted.", Icon: Sparkles },
  { key: "publish", n: "04", label: "Publish", hint: "Send the plan to your Comms Library as a draft.", Icon: Send },
];

function tone(status: StepStatus, active: boolean) {
  if (status === "done") return "border-ink-950 bg-ink-950 text-paper-0";
  if (status === "failed") return "border-rose-300 bg-rose-50 text-rose-700";
  if (status === "active" || active) return "border-ink-950 bg-paper-0 text-ink-950";
  return "border-line-200 bg-paper-0 text-ink-500";
}

export function OppositionStepper({ state }: { state: StepperState }) {
  const activeIdx = (() => {
    const order: (keyof StepperState)[] = ["capture", "analyze", "plan", "publish"];
    for (let i = 0; i < order.length; i += 1) {
      if (state[order[i]] === "active") return i;
    }
    for (let i = order.length - 1; i >= 0; i -= 1) {
      if (state[order[i]] === "done") return Math.min(i + 1, order.length - 1);
    }
    return 0;
  })();

  return (
    <ol className="grid grid-cols-1 gap-2 md:grid-cols-4">
      {STEPS.map((s, i) => {
        const status = state[s.key];
        const active = i === activeIdx;
        const Icon = s.Icon;
        return (
          <li
            key={s.key}
            className={`flex flex-col gap-2 border p-3 transition ${tone(status, active)}`}
          >
            <div className="flex items-center justify-between">
              <span className={`font-mono text-[10px] uppercase tracking-[0.22em] ${status === "done" ? "text-paper-0/70" : "text-ink-500"}`}>
                Step {s.n}
              </span>
              <span className="inline-flex h-5 w-5 items-center justify-center">
                {status === "done" ? (
                  <Check size={13} />
                ) : status === "active" ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Icon size={13} className={status === "failed" ? "text-rose-600" : "text-ink-500"} />
                )}
              </span>
            </div>
            <p className={`font-serif text-base leading-tight ${status === "done" ? "text-paper-0" : "text-ink-950"}`}>
              {s.label}
            </p>
            <p className={`text-[11px] leading-snug ${status === "done" ? "text-paper-0/80" : "text-ink-500"}`}>
              {s.hint}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
