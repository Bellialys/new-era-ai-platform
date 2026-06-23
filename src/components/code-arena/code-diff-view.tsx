"use client";

import type { ArenaResponseView } from "@/types/arena";

type CodeDiffViewProps = {
  responses: ArenaResponseView[];
  blindMode: boolean;
};

const BLIND_LABELS = ["Модель A", "Модель B", "Модель C"];

// Split text into lines
function splitLines(text: string): string[] {
  return text.split("\n");
}

// Simple line-level diff: returns per-line status for two texts
type LineDiffEntry =
  | { kind: "same"; text: string }
  | { kind: "removed"; text: string }
  | { kind: "added"; text: string };

function computeLineDiff(left: string[], right: string[]): { left: (LineDiffEntry | null)[]; right: (LineDiffEntry | null)[] } {
  // LCS-based line diff (Myers-lite: greedy for equal lines)
  const leftOut: (LineDiffEntry | null)[] = [];
  const rightOut: (LineDiffEntry | null)[] = [];

  let li = 0;
  let ri = 0;

  // Build a lookup for right lines
  while (li < left.length || ri < right.length) {
    const lLine = left[li];
    const rLine = right[ri];

    if (li >= left.length) {
      // Only right remains
      leftOut.push(null);
      rightOut.push({ kind: "added", text: rLine! });
      ri++;
    } else if (ri >= right.length) {
      // Only left remains
      leftOut.push({ kind: "removed", text: lLine! });
      rightOut.push(null);
      li++;
    } else if (lLine === rLine) {
      leftOut.push({ kind: "same", text: lLine! });
      rightOut.push({ kind: "same", text: rLine! });
      li++;
      ri++;
    } else {
      // Look ahead — find next match within 3 lines
      const lookahead = 4;
      let found = false;
      for (let skip = 1; skip <= lookahead; skip++) {
        if (ri + skip < right.length && right[ri + skip] === lLine) {
          // Insert right lines first
          for (let s = 0; s < skip; s++) {
            leftOut.push(null);
            rightOut.push({ kind: "added", text: right[ri + s]! });
          }
          ri += skip;
          found = true;
          break;
        }
        if (li + skip < left.length && left[li + skip] === rLine) {
          // Remove left lines first
          for (let s = 0; s < skip; s++) {
            leftOut.push({ kind: "removed", text: left[li + s]! });
            rightOut.push(null);
          }
          li += skip;
          found = true;
          break;
        }
      }
      if (!found) {
        leftOut.push({ kind: "removed", text: lLine! });
        rightOut.push({ kind: "added", text: rLine! });
        li++;
        ri++;
      }
    }
  }

  return { left: leftOut, right: rightOut };
}

function lineClass(entry: LineDiffEntry | null): string {
  if (!entry) return "bg-transparent";
  if (entry.kind === "removed") return "bg-red-950/40";
  if (entry.kind === "added") return "bg-emerald-950/40";
  return "";
}

function lineText(entry: LineDiffEntry | null): string {
  if (!entry) return "\u00a0"; // &nbsp; to keep row height
  return entry.text === "" ? "\u00a0" : entry.text;
}

function DiffPanel({
  title,
  leftLines,
  rightLines,
  showLeft,
}: {
  title: string;
  leftLines: (LineDiffEntry | null)[];
  rightLines: (LineDiffEntry | null)[];
  showLeft: boolean;
}) {
  const lines = showLeft ? leftLines : rightLines;
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300">
        {title}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-white/5 bg-slate-950/80">
        <pre className="text-sm leading-6 text-slate-200">
          {lines.map((entry, i) => (
            <div
              key={i}
              className={`flex gap-2 px-4 ${lineClass(entry)}`}
            >
              <span className="w-8 shrink-0 select-none text-right text-slate-600">
                {entry ? i + 1 : ""}
              </span>
              <span className="whitespace-pre-wrap break-all">{lineText(entry)}</span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

export function CodeDiffView({ responses, blindMode }: CodeDiffViewProps) {
  const successResponses = responses.filter((r) => r.status === "success" && r.answerText);

  if (successResponses.length < 2) return null;

  // Compare first two successful responses
  const a = successResponses[0]!;
  const b = successResponses[1]!;

  const aLines = splitLines(a.answerText ?? "");
  const bLines = splitLines(b.answerText ?? "");
  const { left, right } = computeLineDiff(aLines, bLines);

  const aLabel = blindMode ? (BLIND_LABELS[0] ?? "Модель A") : a.modelName;
  const bLabel = blindMode ? (BLIND_LABELS[1] ?? "Модель B") : b.modelName;

  const sameCount = left.filter((e) => e?.kind === "same").length;
  const diffCount = left.filter((e) => e?.kind !== "same").length + right.filter((e) => e?.kind !== "same" && e !== null).length;
  const pctSame = left.length ? Math.round((sameCount / left.length) * 100) : 100;

  return (
    <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h3 className="text-sm font-bold text-white">Сравнение кода</h3>
        <span className="rounded-full bg-violet-500/15 px-2.5 py-0.5 text-xs text-violet-200">
          {pctSame}% совпадений
        </span>
        <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-slate-400">
          {diffCount} различий
        </span>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2">
        <DiffPanel title={aLabel} leftLines={left} rightLines={right} showLeft={true} />
        <DiffPanel title={bLabel} leftLines={left} rightLines={right} showLeft={false} />
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Красный — только в {aLabel}. Зелёный — только в {bLabel}.
      </p>
    </div>
  );
}
