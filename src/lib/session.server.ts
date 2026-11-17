import { clearSession, getSession, updateSession } from "@tanstack/react-start/server";

// Hardcoded admin per owner's request: entering this ITS ID opens the admin panel (no password).
export const ADMIN_ITS_ID = "50480993";

export type PortalSession = { role?: "admin" | "member"; memberId?: string };

async function sessionConfig() {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!key) throw new Error("Server configuration missing");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`zakereen-session:${key}`),
  );
  const password = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return {
    password,
    name: "zakereen_session",
    maxAge: 60 * 60 * 24 * 30,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

export async function readSession(): Promise<PortalSession> {
  const session = await getSession<PortalSession>(await sessionConfig());
  return session.data ?? {};
}

export async function writeSession(data: PortalSession) {
  await updateSession<PortalSession>(await sessionConfig(), data);
}

export async function endSession() {
  await clearSession(await sessionConfig());
}

export async function requireAdmin() {
  const s = await readSession();
  if (s.role !== "admin") throw new Error("Not allowed");
}

export async function requireMember(): Promise<string> {
  const s = await readSession();
  if (s.role !== "member" || !s.memberId) throw new Error("Please sign in again");
  return s.memberId;
}
