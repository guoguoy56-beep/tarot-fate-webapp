import { createAuthRuntime, getDemoAuthConfig } from "@/lib/auth-config";

let runtime: ReturnType<typeof createAuthRuntime> | undefined;

export function getAuthBaseURL(): string { return getDemoAuthConfig().baseURL; }

export async function getAuth() {
  const config = getDemoAuthConfig();
  runtime ??= createAuthRuntime(config).catch((error) => { runtime = undefined; throw error; });
  return (await runtime).auth;
}

export async function getSessionForRequest(request: Request) {
  return (await getAuth()).api.getSession({ headers: request.headers });
}
