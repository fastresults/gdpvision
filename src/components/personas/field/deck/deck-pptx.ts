// @domain personas
// @ui src/components/personas/field/briefing/BriefingPanel.tsx
//
// Chamber 07 · Client-side .pptx export of the commencement deck. Editable in
// PowerPoint and Keynote, laid out to match the on-screen slides.

import type { ProgrammeDeck } from "@/lib/personas/programme-deck.functions";

const INK = "12100E";
const PAPER = "FAF8F4";
const GOLD = "9A7B37";
const MUTED = "6C6157";

export async function exportDeckToPptx(deck: ProgrammeDeck): Promise<void> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9"; // 10 × 5.625 in
  pptx.author = deck.programmeTitle;
  pptx.company = deck.countryCode;
  pptx.title = `${deck.programmeTitle} — Commencement deck`;

  const total = deck.slides.length;

  deck.slides.forEach((s, idx) => {
    const dark = s.kind === "cover" || s.kind === "closing";
    const bg = dark ? INK : PAPER;
    const fg = dark ? PAPER : INK;
    const soft = dark ? "C9C3BA" : MUTED;

    const slide = pptx.addSlide();
    slide.background = { color: bg };

    slide.addText(s.eyebrow.toUpperCase(), {
      x: 0.6,
      y: 0.45,
      w: 8.8,
      h: 0.3,
      fontFace: "Consolas",
      fontSize: 11,
      charSpacing: 2,
      color: soft,
    });

    slide.addText(s.heading, {
      x: 0.6,
      y: dark ? 1.9 : 0.85,
      w: 8.8,
      h: dark ? 1.5 : 1.1,
      fontFace: "Georgia",
      fontSize: dark ? 44 : 32,
      color: fg,
      valign: "top",
    });

    let cursor = dark ? 3.4 : 2.0;

    if (s.subheading) {
      slide.addText(s.subheading, {
        x: 0.6,
        y: cursor,
        w: 8.0,
        h: 0.6,
        fontFace: "Calibri",
        fontSize: 18,
        color: soft,
      });
      cursor += 0.75;
    }

    const hasRows = !!s.rows?.length;

    if (s.bullets?.length) {
      slide.addText(
        s.bullets.map((b) => ({ text: b, options: { bullet: { code: "2022" }, breakLine: true } })),
        {
          x: 0.6,
          y: cursor,
          w: hasRows ? 4.6 : 8.6,
          h: 2.0,
          fontFace: "Calibri",
          fontSize: 16,
          color: dark ? PAPER : "2B2620",
          lineSpacingMultiple: 1.3,
          valign: "top",
        },
      );
      cursor += 2.1;
    }

    if (s.stats?.length) {
      const statY = Math.min(cursor, 4.05);
      s.stats.slice(0, 3).forEach((st, i) => {
        const x = 0.6 + i * 2.6;
        slide.addText(st.label.toUpperCase(), {
          x,
          y: statY,
          w: 2.4,
          h: 0.25,
          fontFace: "Consolas",
          fontSize: 10,
          charSpacing: 2,
          color: soft,
        });
        slide.addText(st.value, {
          x,
          y: statY + 0.22,
          w: 2.4,
          h: 0.55,
          fontFace: "Georgia",
          fontSize: 28,
          color: fg,
        });
        if (st.note) {
          slide.addText(st.note, {
            x,
            y: statY + 0.78,
            w: 2.4,
            h: 0.3,
            fontFace: "Calibri",
            fontSize: 10,
            color: soft,
          });
        }
      });
    }

    if (s.rows?.length) {
      const rows = s.rows.slice(0, 8);
      const startY = s.bullets?.length || s.subheading ? 2.0 : 2.0;
      const rowH = Math.min(0.42, (4.4 - startY) / rows.length);
      rows.forEach((r, i) => {
        const y = startY + i * rowH;
        slide.addText(r.left, {
          x: hasRows && s.bullets?.length ? 5.4 : 0.6,
          y,
          w: 0.5,
          h: rowH,
          fontFace: "Consolas",
          fontSize: 11,
          color: GOLD,
          valign: "middle",
        });
        slide.addText(r.right, {
          x: (hasRows && s.bullets?.length ? 5.4 : 0.6) + 0.5,
          y,
          w: hasRows && s.bullets?.length ? 3.5 : 8.0,
          h: rowH,
          fontFace: "Calibri",
          fontSize: 13,
          color: dark ? PAPER : "2B2620",
          valign: "middle",
        });
      });
    }

    slide.addShape(pptx.ShapeType.line, {
      x: 0.6,
      y: 4.85,
      w: 8.8,
      h: 0,
      line: { color: dark ? "3A342C" : "DED8CE", width: 1 },
    });

    slide.addText(s.note ?? deck.programmeTitle, {
      x: 0.6,
      y: 4.95,
      w: 6.8,
      h: 0.3,
      fontFace: "Consolas",
      fontSize: 10,
      charSpacing: 2,
      color: soft,
    });

    slide.addText(`${String(idx + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`, {
      x: 7.6,
      y: 4.95,
      w: 1.8,
      h: 0.3,
      align: "right",
      fontFace: "Consolas",
      fontSize: 10,
      charSpacing: 2,
      color: soft,
    });
  });

  const safe = deck.programmeTitle.replace(/[^\w\- ]+/g, "").trim() || "programme";
  await pptx.writeFile({ fileName: `${safe} — commencement deck v${deck.version}.pptx` });
}
