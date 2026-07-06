"use client";

import type React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

type CP = { children?: React.ReactNode };

export function sanitizeMarkdownUrl(href: string | undefined): string | undefined {
  if (!href) return undefined;
  const value = href.trim();
  if (!value) return undefined;

  if (value.startsWith("#") || value.startsWith("/")) {
    return value;
  }

  try {
    const url = new URL(value);
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? value : undefined;
  } catch {
    return undefined;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const components: any = {
  h1: ({ children }: CP) => (
    <h1 className="mb-4 mt-6 text-xl font-black text-white first:mt-0">{children}</h1>
  ),
  h2: ({ children }: CP) => (
    <h2 className="mb-3 mt-5 text-lg font-bold text-white first:mt-0">{children}</h2>
  ),
  h3: ({ children }: CP) => (
    <h3 className="mb-2 mt-4 text-base font-bold text-slate-100 first:mt-0">{children}</h3>
  ),

  p: ({ children }: CP) => (
    <p className="mb-3 leading-7 text-slate-200 last:mb-0">{children}</p>
  ),

  pre: ({ children }: CP) => (
    <pre className="my-3 overflow-x-auto rounded-xl border border-white/10 bg-[#0d1117] p-4 text-sm leading-6">
      {children}
    </pre>
  ),

  code: ({ children, className, ...props }: { children?: React.ReactNode; className?: string }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code
          className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-sm text-violet-300"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },

  strong: ({ children }: CP) => (
    <strong className="font-bold text-white">{children}</strong>
  ),
  em: ({ children }: CP) => (
    <em className="italic text-slate-300">{children}</em>
  ),

  ul: ({ children }: CP) => (
    <ul className="mb-3 list-disc pl-5 leading-7 text-slate-200 last:mb-0">{children}</ul>
  ),
  ol: ({ children }: CP) => (
    <ol className="mb-3 list-decimal pl-5 leading-7 text-slate-200 last:mb-0">{children}</ol>
  ),
  li: ({ children }: CP) => <li className="mb-1">{children}</li>,

  blockquote: ({ children }: CP) => (
    <blockquote className="my-3 border-l-4 border-violet-500/50 pl-4 italic text-slate-400">
      {children}
    </blockquote>
  ),

  hr: () => <hr className="my-4 border-white/10" />,

  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
    const safeHref = sanitizeMarkdownUrl(href);
    if (!safeHref) {
      return <span className="text-slate-200">{children}</span>;
    }

    return (
      <a
        href={safeHref}
        target="_blank"
        rel="noopener noreferrer"
        className="text-violet-300 underline underline-offset-2 transition hover:text-violet-100"
      >
        {children}
      </a>
    );
  },

  table: ({ children }: CP) => (
    <div className="my-3 overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }: CP) => <thead>{children}</thead>,
  tbody: ({ children }: CP) => <tbody>{children}</tbody>,
  tr: ({ children }: CP) => (
    <tr className="border-b border-white/10 even:bg-white/[0.03]">{children}</tr>
  ),
  th: ({ children }: CP) => (
    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
      {children}
    </th>
  ),
  td: ({ children }: CP) => (
    <td className="px-3 py-2 text-slate-200">{children}</td>
  ),
};

type MarkdownRendererProps = {
  content: string;
  className?: string;
};

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        remarkPlugins={[remarkGfm] as any}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rehypePlugins={[rehypeHighlight] as any}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
