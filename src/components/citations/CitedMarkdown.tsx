import { Children, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { CitedText } from "./CitedText";
import type { CitationRef } from "./CitationSup";

function wrapChildren(
  children: ReactNode,
  citations?: CitationRef[] | string[] | null,
): ReactNode {
  return Children.map(children, (child, i) => {
    if (typeof child === "string") {
      return <CitedText key={i} text={child} citations={citations} />;
    }
    return child;
  });
}

function componentsFor(
  citations?: CitationRef[] | string[] | null,
): Components {
  const wrap = (c: ReactNode) => wrapChildren(c, citations);
  return {
    h1: ({ children }) => (
      <h1 className="mt-4 mb-2 font-serif text-[20px] font-semibold leading-tight text-ink-950 first:mt-0">
        {wrap(children)}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="mt-4 mb-2 font-serif text-[17px] font-semibold leading-tight text-ink-950 first:mt-0">
        {wrap(children)}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="mt-3 mb-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500 first:mt-0">
        {wrap(children)}
      </h3>
    ),
    p: ({ children }) => (
      <p className="mb-2.5 leading-relaxed last:mb-0">{wrap(children)}</p>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-ink-950">{wrap(children)}</strong>
    ),
    em: ({ children }) => <em className="italic">{wrap(children)}</em>,
    a: ({ children, href }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-ink-950 underline decoration-line-200 underline-offset-2 hover:decoration-ink-950"
      >
        {wrap(children)}
      </a>
    ),
    ul: ({ children }) => (
      <ul className="mb-2.5 ml-4 list-disc space-y-1 marker:text-ink-500">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="mb-2.5 ml-4 list-decimal space-y-1 marker:text-ink-500">
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="pl-1">{wrap(children)}</li>,
    blockquote: ({ children }) => (
      <blockquote className="my-3 border-l-2 border-ink-950/30 bg-paper-50/60 px-3 py-1.5 italic text-ink-700">
        {wrap(children)}
      </blockquote>
    ),
    hr: () => <hr className="my-4 border-line-200" />,
    code: ({ children }) => (
      <code className="rounded-sm bg-paper-100 px-1 py-0.5 font-mono text-[12px] text-ink-950">{children}</code>
    ),
    pre: ({ children }) => (
      <pre className="my-3 overflow-x-auto border border-line-200 bg-paper-50 p-3 font-mono text-[12px] text-ink-950">{children}</pre>
    ),
    table: ({ children }) => (
      <div className="my-3 overflow-x-auto border border-line-200">
        <table className="w-full border-collapse text-[12px]">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead>{children}</thead>,
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children }) => <tr>{children}</tr>,
    th: ({ children }) => (
      <th className="border-b border-line-200 bg-paper-50 px-2 py-1 text-left font-semibold text-ink-950">
        {wrap(children)}
      </th>
    ),
    td: ({ children }) => (
      <td className="border-b border-line-200 px-2 py-1 text-ink-800">
        {wrap(children)}
      </td>
    ),
  };
}

/**
 * Global markdown renderer that turns [N] / [N][M] / [N,M] markers into
 * hoverable superscript citation chips backed by `citations`.
 */
export function CitedMarkdown({
  source,
  citations,
  className,
}: {
  source: string;
  citations?: CitationRef[] | string[] | null;
  className?: string;
}) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={componentsFor(citations)}>
        {source || ""}
      </ReactMarkdown>
    </div>
  );
}
