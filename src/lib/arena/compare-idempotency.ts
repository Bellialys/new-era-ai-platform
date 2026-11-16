/** A request ticket survives a failed browser fetch, not a successful compare. */
export type CompareIdempotencyTicket = Readonly<{
  fingerprint: string;
  key: string;
}>;

export type CompareIdempotencyInput = Readonly<{
  prompt: string;
  modelIds: readonly string[];
  blind: boolean;
}>;

/**
 * Keep one key for a logical compare submission and reuse it after a transport
 * failure. Once the input changes or a completed answer arrives, create a new
 * ticket. Never trust this client-side helper as server quota authority.
 */
export function nextCompareIdempotencyTicket(
  previous: CompareIdempotencyTicket | null,
  input: CompareIdempotencyInput,
  generateKey: () => string = () => crypto.randomUUID()
): CompareIdempotencyTicket {
  const fingerprint = JSON.stringify({
    modeSlug: "prompt-arena",
    prompt: input.prompt,
    modelIds: input.modelIds,
    blind: input.blind,
  });
  if (previous?.fingerprint === fingerprint) return previous;
  return { fingerprint, key: generateKey() };
}
