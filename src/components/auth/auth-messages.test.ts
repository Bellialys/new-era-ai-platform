import { describe, expect, it } from "vitest";
import { getAuthErrorMessage, isAccountExistenceError } from "./auth-messages";

describe("auth message privacy", () => {
  it.each(["Invalid login credentials", "Email not confirmed", "User not found"])(
    "uses the same login response for provider error: %s",
    (message) => {
      expect(getAuthErrorMessage(message, "login")).toBe("Invalid email or password.");
    }
  );

  it("does not expose an existing account through the signup error message", () => {
    expect(getAuthErrorMessage("User already registered", "signup")).toBe(
      "Unable to create an account. Please try again later."
    );
  });

  it.each(["User already registered", "Email already exists"])(
    "recognizes an account-existence provider error: %s",
    (message) => {
      expect(isAccountExistenceError(message)).toBe(true);
    }
  );

  it.each(["email_exists", "user_already_exists"])(
    "recognizes a stable account-existence provider code: %s",
    (code) => {
      expect(isAccountExistenceError("redacted", code)).toBe(true);
    }
  );
});
