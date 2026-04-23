type ErrorLike = { message?: string | null } | string | null | undefined;

export function friendlyError(error: ErrorLike, fallback = "Something went wrong. Please try again."): string {
  const rawMessage = typeof error === "string" ? error : error?.message ?? "";
  const message = rawMessage.trim();
  const lowerMessage = message.toLowerCase();

  if (!message) return fallback;

  if (
    lowerMessage.includes("jwt expired") ||
    lowerMessage.includes("invalid jwt") ||
    lowerMessage.includes("refresh token") ||
    lowerMessage.includes("session not found") ||
    lowerMessage.includes("token has expired")
  ) {
    return "Your session has expired. Please log in again.";
  }

  if (lowerMessage.includes("invalid login credentials")) {
    return "The email or password is incorrect.";
  }

  if (lowerMessage.includes("email not confirmed")) {
    return "Please confirm your email address before logging in.";
  }

  if (lowerMessage.includes("user already registered") || lowerMessage.includes("already been registered")) {
    return "An account with this email already exists. Please log in instead.";
  }

  if (lowerMessage.includes("permission denied") || lowerMessage.includes("row-level security") || lowerMessage.includes("not authorized")) {
    return "You do not have permission to do that. Please log in with the right account.";
  }

  if (lowerMessage.includes("duplicate key") || lowerMessage.includes("unique constraint")) {
    return "That record already exists. Please use different details.";
  }

  if (lowerMessage.includes("network") || lowerMessage.includes("failed to fetch")) {
    return "We could not connect right now. Please check your internet and try again.";
  }

  if (lowerMessage.includes("storage") || lowerMessage.includes("bucket")) {
    return "We could not upload or open that file right now. Please try again.";
  }

  return fallback;
}
