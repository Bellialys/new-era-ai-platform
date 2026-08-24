/** Returns whether a Supabase Auth error would disclose that an account exists. */
export function isAccountExistenceError(message?: string, code?: string): boolean {
  const normalizedMessage = message?.toLowerCase() ?? "";
  const normalizedCode = code?.toLowerCase() ?? "";
  return (
    ["email_exists", "user_already_exists"].includes(normalizedCode) ||
    normalizedMessage.includes("already registered") ||
    normalizedMessage.includes("already exists")
  );
}
