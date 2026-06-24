export type SupportedLanguage = 'javascript' | 'typescript' | 'python' | 'go' | 'rust' | 'cpp' | 'java';

export const LANGUAGE_CONFIG: Record<SupportedLanguage, { label: string; pistonId: string; version: string; monacoId: string }> = {
  javascript: { label: 'JavaScript', pistonId: 'javascript', version: '*', monacoId: 'javascript' },
  typescript: { label: 'TypeScript', pistonId: 'typescript', version: '*', monacoId: 'typescript' },
  python:     { label: 'Python',     pistonId: 'python',     version: '*', monacoId: 'python' },
  go:         { label: 'Go',         pistonId: 'go',         version: '*', monacoId: 'go' },
  rust:       { label: 'Rust',       pistonId: 'rust',       version: '*', monacoId: 'rust' },
  cpp:        { label: 'C++',        pistonId: 'cpp',        version: '*', monacoId: 'cpp' },
  java:       { label: 'Java',       pistonId: 'java',       version: '*', monacoId: 'java' },
};

/** Resolve a language display name or Piston key to its SupportedLanguage key. */
export function findLanguageKey(language: string): SupportedLanguage | null {
  const lower = language.toLowerCase();
  if (lower in LANGUAGE_CONFIG) return lower as SupportedLanguage;
  const entry = Object.entries(LANGUAGE_CONFIG).find(
    ([, cfg]) => cfg.label.toLowerCase() === lower
  );
  return entry ? (entry[0] as SupportedLanguage) : null;
}
