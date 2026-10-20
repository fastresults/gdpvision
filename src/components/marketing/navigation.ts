// Single source for the public site's grouped navigation (mega-menu, phone menu and footer).
export type NavEntry = { to: string; hash?: string; label: string; description: string };
export type NavGroup = {
  id: string;
  label: string;
  intro: string;
  links: NavEntry[];
  featured: { to: string; hash?: string; eyebrow: string; title: string; body: string };
  /** Panel is drawn in the GDP Events style language. */
  events?: boolean;
};

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "platform",
    label: "Platform",
    intro: "One government-controlled system for testing and delivering national decisions.",
    links: [
      { to: "/", hash: "instrument", label: "How it works", description: "The ten connected Chambers, from data to delivery." },
      { to: "/", hash: "corpus", label: "Second Brain", description: "The national record every Chamber reads from." },
      { to: "/", hash: "sovereignty", label: "Sovereignty", description: "Government holds the data, the access and the switch." },
      { to: "/vault", label: "The Vault", description: "Where protected national records stay under control." },
    ],
    featured: {
      to: "/present",
      eyebrow: "The briefing",
      title: "See GDPVision in one sitting",
      body: "The full presentation, with live examples from every Chamber.",
    },
  },
  {
    id: "record",
    label: "Record & Proof",
    intro: "Where the numbers come from, and how they are checked.",
    links: [
      { to: "/record", label: "The National Record", description: "The public side of the Second Brain." },
      { to: "/", hash: "measures", label: "Measuring bodies & indexes", description: "The ten international bodies and the Caribbean Indices." },
      { to: "/", hash: "provenance", label: "Provenance", description: "Every figure linked to its source." },
    ],
    featured: {
      to: "/record",
      eyebrow: "Open the record",
      title: "The National Record",
      body: "Trusted data, organised by sector and country.",
    },
  },
  {
    id: "insights",
    label: "Insights",
    intro: "The case, the brief and the thinking behind GDPVision.",
    links: [
      { to: "/business-case", label: "The business case", description: "Economic value first, with sources." },
      { to: "/business-case/brief", label: "The Decision Brief", description: "A country-specific brief you can print." },
      { to: "/business-case/calculator", label: "Value calculator", description: "Estimate the value of faster, better decisions." },
      { to: "/op-eds", label: "The writing", description: "Op-eds on each Chamber and the choices they serve." },
    ],
    featured: {
      to: "/op-eds",
      eyebrow: "Latest writing",
      title: "Op-eds from the Chambers",
      body: "Short essays for leaders on the decisions each Chamber supports.",
    },
  },
  {
    id: "events",
    label: "GDP Events",
    intro: "Summits, roundtables and briefings across the region.",
    events: true,
    links: [
      { to: "/events", label: "Upcoming events", description: "Register for the next summit or roundtable." },
      { to: "/events", hash: "past", label: "Past events & recordings", description: "Catch up on what was tested and agreed." },
      { to: "/events/host", label: "Host an event", description: "Bring a GDPVision session to your country." },
    ],
    featured: {
      to: "/events",
      eyebrow: "Next up",
      title: "Caribbean Economic Leadership Summit",
      body: "Heads of Government test national choices side by side.",
    },
  },
];
