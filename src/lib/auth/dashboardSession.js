import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DATA_DIR } from "@/lib/dataDir";
import { getSettings } from "@/lib/localDb";

const DEFAULT_PASSWORD = "123456";
const SESSION_MAX_AGE_SEC = 24 * 60 * 60;

// Initial (pre-change) dashboard password: INITIAL_PASSWORD env wins; otherwise
// a random value generated once and persisted next to the JWT secret, printed to
// the console at generation. Replaces the public "123456" default as the
// first-boot credential while keeping restarts stable.
const INITIAL_PASSWORD_FILE = path.join(DATA_DIR, "initial-password");
let initialPasswordSource = null;

export function getInitialPassword() {
  if (initialPasswordSource) return { password: initialPasswordSource.value, source: initialPasswordSource.kind };
  if (process.env.INITIAL_PASSWORD) {
    initialPasswordSource = { value: process.env.INITIAL_PASSWORD, kind: "env" };
    return { password: process.env.INITIAL_PASSWORD, source: "env" };
  }
  try {
    const existing = fs.readFileSync(INITIAL_PASSWORD_FILE, "utf8").trim();
    if (existing) {
      initialPasswordSource = { value: existing, kind: "generated" };
      return { password: existing, source: "generated" };
    }
  } catch {}
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const generated = crypto.randomBytes(6).toString("base64url");
  fs.writeFileSync(INITIAL_PASSWORD_FILE, generated, { mode: 0o600 });
  console.log(`\n[9Router] Initial dashboard password: ${generated}\n[9Router] (stored at ${INITIAL_PASSWORD_FILE} — set a permanent password in the dashboard to remove this file.)\n`);
  initialPasswordSource = { value: generated, kind: "generated" };
  return { password: generated, source: "generated" };
}

// Called when the user sets a real password — the generated initial value is dead.
export function clearInitialPasswordFile() {
  try { fs.unlinkSync(INITIAL_PASSWORD_FILE); } catch {}
  initialPasswordSource = null;
}

function loadJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const file = path.join(DATA_DIR, "jwt-secret");
  try {
    return fs.readFileSync(file, "utf8").trim();
  } catch {}
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const generated = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(file, generated, { mode: 0o600 });
  return generated;
}

const SECRET = new TextEncoder().encode(loadJwtSecret());

export function shouldUseSecureCookie(request) {
  const forceSecureCookie = process.env.AUTH_COOKIE_SECURE === "true";
  const forwardedProto = request?.headers?.get?.("x-forwarded-proto");
  const isHttpsRequest = forwardedProto === "https";
  return forceSecureCookie || isHttpsRequest;
}

export async function createDashboardAuthToken(claims = {}) {
  return new SignJWT({ authenticated: true, ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(SECRET);
}

export async function verifyDashboardAuthToken(token) {
  if (!token) return false;
  try {
    await jwtVerify(token, SECRET);
    return true;
  } catch {
    return false;
  }
}

export async function getDashboardAuthSession(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload;
  } catch {
    return null;
  }
}

export async function setDashboardAuthCookie(cookieStore, request, claims = {}) {
  const token = await createDashboardAuthToken(claims);
  cookieStore.set("auth_token", token, {
    httpOnly: true,
    secure: shouldUseSecureCookie(request),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

export function clearDashboardAuthCookie(cookieStore) {
  cookieStore.delete("auth_token");
}

// Verify the current dashboard password (re-auth for sensitive actions).
export async function verifyDashboardPassword(password) {
  if (typeof password !== "string" || !password) return false;
  const settings = await getSettings();
  const storedHash = settings?.password;
  if (storedHash) return bcrypt.compare(password, storedHash);
  const initialPassword = process.env.INITIAL_PASSWORD || DEFAULT_PASSWORD;
  return password === initialPassword;
}
