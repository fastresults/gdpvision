import heroImage from "@/assets/marketing-hero.jpg";

export function MarketingHome() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="text-xl font-semibold tracking-tight">GDP Vision</div>
        <nav className="flex items-center gap-6 text-sm">
          <a href="#features" className="opacity-80 hover:opacity-100">Features</a>
          <a href="#contact" className="opacity-80 hover:opacity-100">Contact</a>
          <a
            href="https://present.gdpvision.com"
            className="rounded-md border border-cyan-400/40 bg-cyan-400/10 px-3 py-1.5 text-cyan-200 hover:bg-cyan-400/20"
          >
            Launch Kiosk
          </a>
        </nav>
      </header>

      <section
        className="relative isolate overflow-hidden border-b border-white/5"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(2,6,23,0.55), rgba(2,6,23,0.9)), url(${heroImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="mx-auto max-w-6xl px-6 py-28 md:py-40">
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
            Immersive presentation systems for the Caribbean's next decade.
          </h1>
          <p className="mt-6 max-w-2xl text-lg opacity-80 md:text-xl">
            GDP Vision builds full-screen briefing environments that bring
            summits, ministries, and enterprises into a single, curated view.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <a
              href="https://present.gdpvision.com"
              className="rounded-md bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
            >
              Open the Presentation Kiosk
            </a>
            <a
              href="#contact"
              className="rounded-md border border-white/20 px-5 py-3 text-sm font-semibold hover:bg-white/5"
            >
              Talk to us
            </a>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="text-3xl font-semibold tracking-tight">What we do</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Kiosk Presentation",
              body: "One-touch access to websites, decks, PDFs, videos, and gallery collections in a single fullscreen shell.",
            },
            {
              title: "Curated Galleries",
              body: "Group videos and images into named galleries with drill-down navigation for on-stage or in-booth use.",
            },
            {
              title: "Managed Content",
              body: "Admin console for updating categories, media, and idle imagery without redeploying anything.",
            },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm opacity-75">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="contact" className="border-t border-white/5 bg-slate-950">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <h2 className="text-3xl font-semibold tracking-tight">Get in touch</h2>
          <p className="mt-3 max-w-xl opacity-80">
            We're rebuilding this site. In the meantime, reach us directly to
            preview the presentation system or discuss a deployment.
          </p>
          <a
            href="mailto:hello@gdpvision.com"
            className="mt-6 inline-flex rounded-md bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
          >
            hello@gdpvision.com
          </a>
        </div>
      </section>

      <footer className="border-t border-white/5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm opacity-70">
          <div>© {new Date().getFullYear()} GDP Vision</div>
          <div className="flex gap-6">
            <a href="https://present.gdpvision.com" className="hover:opacity-100">Kiosk</a>
            <a href="https://present.gdpvision.com/admin" className="hover:opacity-100">Admin</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
