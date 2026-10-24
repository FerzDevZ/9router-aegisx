import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fsPromises from "fs/promises";

// Mock next/server
vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({
      status: init?.status || 200,
      body,
      json: async () => body,
    })),
  },
}));

// Mock os
vi.mock("os", () => ({
  default: { homedir: vi.fn(() => "/mock/home") },
  homedir: vi.fn(() => "/mock/home"),
}));

// Mock fs/promises
vi.mock("fs/promises", () => ({
  access: vi.fn(),
  constants: { R_OK: 4 },
}));

// The sqlite3-CLI fallback must never actually shell out in tests — force it
// to fail so every test lands deterministically on better-sqlite3 or the
// manual-prompt strategy. (util.promisify is mocked to identity below, so
// execFileAsync === this callback-style mock.)
vi.mock("child_process", () => ({
  execFile: vi.fn((cmd, args, opts, cb) => {
    if (typeof opts === "function") cb = opts;
    cb(new Error(`CLI unavailable (mock): ${cmd}`));
  }),
}));
vi.mock("util", async (importOriginal) => {
  const util = await importOriginal();
  return { ...util, promisify: (fn) => fn };
});

// Shared mock db instance + class. Hoisted so both the module mock and the
// globalThis.require stub (the route's strategy-1 uses CJS require at runtime,
// which exists in Next's server bundle but not in vitest's ESM) hand back the
// SAME mock.
const h = vi.hoisted(() => {
  const mockDbInstance = {
    prepare: vi.fn(),
    close: vi.fn(),
    __throwOnConstruct: false,
  };
  class MockDatabase {
    constructor() {
      if (mockDbInstance.__throwOnConstruct) {
        throw new Error("SQLITE_CANTOPEN");
      }
      return mockDbInstance;
    }
  }
  return { mockDbInstance, MockDatabase };
});

vi.mock("better-sqlite3", () => ({ default: h.MockDatabase }));

const mockDbInstance = h.mockDbInstance;

// We need to dynamically import after mocks are registered
let GET;

function rowsToGet(rows) {
  // Route queries one key at a time via prepare(...).get(key)
  return (key) => ({ value: rows[key] ?? null });
}

describe("GET /api/oauth/cursor/auto-import", () => {
  const originalPlatform = process.platform;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockDbInstance.__throwOnConstruct = false;
    // Force darwin so macOS-specific logic is exercised
    Object.defineProperty(process, "platform", { value: "darwin", writable: true });
    // Re-import to pick up fresh mocks each run
    const mod = await import("../../src/app/api/oauth/cursor/auto-import/route.js");
    GET = mod.GET;
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform, writable: true });
  });

  // ── Path probing ──────────────────────────────────────────────────────

  it("returns not-found with the checked locations when no db path is accessible", async () => {
    vi.mocked(fsPromises.access).mockRejectedValue(new Error("ENOENT"));

    const response = await GET();

    expect(response.body.found).toBe(false);
    expect(response.body.error).toContain("Cursor database not found");
    expect(response.body.error).toContain("Checked locations:");
    expect(response.body.error).toContain("state.vscdb");
  });

  it("db present but unopenable → strategies exhausted → manual-prompt response", async () => {
    vi.mocked(fsPromises.access).mockResolvedValue();
    mockDbInstance.__throwOnConstruct = true;

    const response = await GET();

    // better-sqlite3 throws, sqlite3 CLI (mocked) fails too → Strategy 3
    expect(response.body.found).toBe(false);
    expect(response.body.windowsManual).toBe(true);
    expect(response.body.dbPath).toContain("state.vscdb");
  });

  // ── Token extraction (better-sqlite3 strategy) ────────────────────────

  it("extracts tokens via per-key queries", async () => {
    vi.mocked(fsPromises.access).mockResolvedValue();
    mockDbInstance.prepare.mockImplementation(() => ({
      get: rowsToGet({
        "cursorAuth/accessToken": "test-token",
        "storage.serviceMachineId": "test-machine-id",
      }),
    }));

    const response = await GET();

    expect(response.body.found).toBe(true);
    expect(response.body.accessToken).toBe("test-token");
    expect(response.body.machineId).toBe("test-machine-id");
    expect(mockDbInstance.close).toHaveBeenCalled();
  });

  it("unwraps JSON-encoded string values", async () => {
    vi.mocked(fsPromises.access).mockResolvedValue();
    mockDbInstance.prepare.mockImplementation(() => ({
      get: rowsToGet({
        "cursorAuth/accessToken": '"json-token"',
        "storage.serviceMachineId": '"json-machine-id"',
      }),
    }));

    const response = await GET();

    expect(response.body.found).toBe(true);
    expect(response.body.accessToken).toBe("json-token");
    expect(response.body.machineId).toBe("json-machine-id");
  });

  it("falls back to the alternate access-token key", async () => {
    vi.mocked(fsPromises.access).mockResolvedValue();
    mockDbInstance.prepare.mockImplementation(() => ({
      get: rowsToGet({
        "cursorAuth/token": "alt-token",
        "storage.machineId": "alt-machine",
      }),
    }));

    const response = await GET();

    expect(response.body.found).toBe(true);
    expect(response.body.accessToken).toBe("alt-token");
    expect(response.body.machineId).toBe("alt-machine");
  });

  it("tokens missing → manual-prompt response", async () => {
    vi.mocked(fsPromises.access).mockResolvedValue();
    mockDbInstance.prepare.mockImplementation(() => ({ get: rowsToGet({}) }));

    const response = await GET();

    expect(response.body.found).toBe(false);
    expect(response.body.windowsManual).toBe(true);
  });

  // ── Platform behavior ─────────────────────────────────────────────────

  it("linux probes its config paths and reports not-found the same way", async () => {
    Object.defineProperty(process, "platform", { value: "linux", writable: true });
    vi.mocked(fsPromises.access).mockRejectedValue(new Error("ENOENT"));

    const response = await GET();

    expect(response.body.found).toBe(false);
    expect(response.body.error).toContain(".config/Cursor");
  });

  it("unknown platforms fall through to the default path set (no 400 gate)", async () => {
    Object.defineProperty(process, "platform", { value: "freebsd", writable: true });
    vi.mocked(fsPromises.access).mockRejectedValue(new Error("ENOENT"));

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.body.found).toBe(false);
    expect(response.body.error).toContain("Cursor database not found");
  });
});
