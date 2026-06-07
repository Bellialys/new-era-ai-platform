export function getAuthErrorMessage(message?: string): string {
  const normalizedMessage = message?.toLowerCase() ?? "";

  if (normalizedMessage.includes("invalid login credentials")) {
    return "Invalid email or password.";
  }

  if (normalizedMessage.includes("email not confirmed")) {
    return "Please confirm your email before signing in.";
  }

  if (normalizedMessage.includes("user already registered")) {
    return "An account with this email already exists.";
  }

  if (normalizedMessage.includes("password")) {
    return "Please use a stronger password.";
  }

  return message ?? "Authentication failed. Please try again.";
}
