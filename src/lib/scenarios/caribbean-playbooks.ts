// Curated "What if…" prompts for Caribbean ministers. Each chip becomes the
// question passed to askAndCreateScenario, which routes through the existing
// recommendScenario AI pipeline.

export type CaribbeanChip = {
  id: string;
  label: string;
  question: string;
  icon: string; // emoji — deliberate, warm, mobile-friendly
  category: "shock" | "growth" | "fiscal" | "climate";
};

export const CARIBBEAN_CHIPS: CaribbeanChip[] = [
  {
    id: "tourism-drop-20",
    label: "Tourism drops 20%",
    question:
      "What happens to GDP, jobs and the fiscal balance if stay-over tourism arrivals fall 20% over the next 12 months? What offsets should we consider?",
    icon: "🏖️",
    category: "shock",
  },
  {
    id: "hurricane-q3",
    label: "Hurricane hits Q3",
    question:
      "Model a category-3 hurricane strike in Q3 with 6 months of reconstruction. What is the GDP hit, which ministries carry the load, and what emergency reallocation makes sense?",
    icon: "🌀",
    category: "climate",
  },
  {
    id: "fuel-duty-cut",
    label: "Cut fuel duty",
    question:
      "What if we cut fuel duty by 25% to ease cost of living? Show the GDP effect, revenue loss, and offsetting revenue moves.",
    icon: "⛽",
    category: "fiscal",
  },
  {
    id: "bpo-grow-10",
    label: "Grow BPO 10%",
    question:
      "What if we grow the BPO / digital services sector by 10% over three years through targeted investment? Where does GDP land and which ministries need to move?",
    icon: "💻",
    category: "growth",
  },
  {
    id: "remittances-fall",
    label: "Remittances fall 15%",
    question:
      "If remittances fall 15% due to a US slowdown, what is the ripple through household consumption, GDP, and the current account?",
    icon: "💸",
    category: "shock",
  },
  {
    id: "cruise-fee",
    label: "Raise cruise head-tax",
    question:
      "What if we raise the cruise passenger head-tax by $10? Model revenue gain, arrival elasticity, and net GDP effect.",
    icon: "🚢",
    category: "fiscal",
  },
  {
    id: "min-wage",
    label: "Raise minimum wage",
    question:
      "What if we raise the minimum wage by 15% over two years? Show employment, GDP, inflation and fiscal effects.",
    icon: "🧾",
    category: "growth",
  },
  {
    id: "climate-adapt",
    label: "Climate adaptation push",
    question:
      "What if we commit 2% of GDP annually to climate adaptation and resilience for five years? Show the GDP path, sector shift, and fiscal cost.",
    icon: "🌿",
    category: "climate",
  },
];
