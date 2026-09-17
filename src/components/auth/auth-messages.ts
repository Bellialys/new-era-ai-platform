export type AuthErrorContext = "login" | "signup" | "password-update";

export {
  isAccountAbsenceError,
  isAccountExistenceError,
} from "@/lib/auth-security";

export function getAuthErrorMessage(
  message?: string,
  context: AuthErrorContext = "login"
): string {
  const normalizedMessage = message?.toLowerCase() ?? "";

  if (context === "login") {
    return "Invalid email or password.";
  }

  if (context === "signup") {
    return "Unable to create an account. Please try again later.";
  }

  if (normalizedMessage.includes("password")) {
    return "Please use a stronger password.";
  }

  return "Authentication failed. Please try again.";
}
