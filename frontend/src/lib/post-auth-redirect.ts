// Post-auth redirect: lets a public page ask the auth flow to return the user
// to where they started (e.g. /agent-watcher?system_type=…) after login/signup.
//
// Mirrors the existing sessionStorage "github_redirect_back" convention used in
// the OAuth callback. A caller stores an intended path before sending the user
// to /login or /signup; the success handlers consume it here.

const POST_AUTH_REDIRECT_KEY = "post_auth_redirect";

/** Store the path to return to after successful authentication. */
export function setPostAuthRedirect(path: string) {
  if (typeof window === "undefined") return;
  if (!path.startsWith("/")) return; // only same-origin relative paths
  sessionStorage.setItem(POST_AUTH_REDIRECT_KEY, path);
}

/**
 * Read and clear the stored redirect. Returns `fallback` when none is set or
 * the stored value is not a safe same-origin path.
 */
export function consumePostAuthRedirect(fallback = "/dashboard"): string {
  if (typeof window === "undefined") return fallback;
  const value = sessionStorage.getItem(POST_AUTH_REDIRECT_KEY);
  sessionStorage.removeItem(POST_AUTH_REDIRECT_KEY);
  if (value && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return fallback;
}
