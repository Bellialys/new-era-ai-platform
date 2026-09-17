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

/**
 * Returns whether an Auth error would disclose that an account does not exist.
 * Password-reset UI may safely map these errors to the same neutral success
 * response as a real reset request, while surfacing operational failures.
 */
export function isAccountAbsenceError(message?: string, code?: string): boolean {
  const normalizedMessage = message?.toLowerCase() ?? "";
  const normalizedCode = code?.toLowerCase() ?? "";
  return (
    normalizedCode === "user_not_found" ||
    normalizedMessage.includes("user not found")
  );
}
