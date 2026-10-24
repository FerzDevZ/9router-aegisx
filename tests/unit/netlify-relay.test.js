import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/models", () => ({
  getProxyPoolById: vi.fn(),
  createProxyPool: vi.fn(async (data) => ({ id: "pool-1", ...data })),
}));

const { getProxyPoolById, createProxyPool } = await import("@/models");
const net = await import("../../src/lib/network/netlifyRelay.js");
const { resolveConnectionProxyConfig } = await import("../../src/lib/network/connectionProxy.js");
const { POST } = await import("../../src/app/api/proxy-pools/netlify-deploy/route.js");

const realFetch = globalThis.fetch;

function stubFetch(handler) {
  globalThis.fetch = handler;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

function postRoute(body) {
  return new Request("http://localhost/api/proxy-pools/netlify-deploy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("netlifyRelay helpers", () => {
  const SECRET = "test-secret";

  it("relay function speaks the shared x-relay-target/x-relay-path/x-relay-secret spec", () => {
    const code = net.buildNetlifyRelayFunctionCode(SECRET);
    expect(code).toContain("x-relay-target");
    expect(code).toContain("x-relay-path");
    expect(code).toContain("x-relay-secret");
    expect(code).toContain('"test-secret"');
  });

  it("relay bundle is Lambda-compatible CJS with string body (digest deploys run no build step)", async () => {
    // Live-verified failure modes: `export default` -> Runtime.UserCodeSyntaxError
    // (502); stream object as body -> cannot-unmarshal-object-into-Go-struct
    // (502). The bundle must use exports.handler and return a string body.
    const code = net.buildNetlifyRelayFunctionCode(SECRET);
    expect(code).not.toMatch(/\bexport\b/);
    expect(code).toContain("exports.handler");

    const runHandler = (fakeFetch, event) => {
      const sandboxExports = {};
      new Function("exports", "fetch", "Buffer", code)(
        sandboxExports, fakeFetch, Buffer
      );
      return sandboxExports.handler(event);
    };
    const missing = await runHandler(async () => { throw new Error("no upstream"); }, { headers: {}, httpMethod: "GET" });
    expect(missing.statusCode).toBe(400);

    // Shared-secret gate: no secret → 401, wrong secret → 401, good secret → forwards.
    const noSecret = await runHandler(async () => { throw new Error("must not fetch"); }, {
      headers: { "x-relay-target": "https://api.example.com" }, httpMethod: "GET",
    });
    expect(noSecret.statusCode).toBe(401);
    const badSecret = await runHandler(async () => { throw new Error("must not fetch"); }, {
      headers: { "x-relay-target": "https://api.example.com", "x-relay-secret": "wrong" }, httpMethod: "GET",
    });
    expect(badSecret.statusCode).toBe(401);

    const goodHeaders = [];
    const okFetch = async (url, init) => {
      goodHeaders.push(init.headers);
      return {
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        arrayBuffer: async () => new TextEncoder().encode(JSON.stringify({ ok: true })).buffer.slice(0),
      };
    };
    const ok = await runHandler(okFetch, {
      headers: {
        "x-relay-target": "https://api.example.com",
        "x-relay-path": "/v1/chat",
        "x-relay-secret": SECRET,
        authorization: "Bearer upstream",
      },
      httpMethod: "POST",
      body: "x",
    });
    expect(ok.statusCode).toBe(200);
    // The secret must not leak upstream alongside the relay control headers.
    expect(goodHeaders[0]["x-relay-secret"]).toBeUndefined();
    expect(goodHeaders[0]["x-relay-target"]).toBeUndefined();
    expect(goodHeaders[0].authorization).toBe("Bearer upstream");

    // Text (JSON/SSE) returns utf8 string with isBase64Encoded false.
    const textFetch = async () => ({
      status: 200,
      headers: new Headers({ "content-type": "application/json; charset=utf-8" }),
      arrayBuffer: async () => new TextEncoder().encode(JSON.stringify({ ok: true })).buffer.slice(0),
    });
    const text = await runHandler(textFetch, {
      headers: { "x-relay-target": "https://api.example.com", "x-relay-path": "/v1/chat", "x-relay-secret": SECRET },
      httpMethod: "POST",
      body: "x",
    });
    expect(text.statusCode).toBe(200);
    expect(text.body).toBe(JSON.stringify({ ok: true }));
    expect(text.isBase64Encoded).toBe(false);

    // SSE stays valid text (buffered, not chunked — Lambda constraint).
    const sseFetch = async () => ({
      status: 200,
      headers: new Headers({ "content-type": "text/event-stream" }),
      arrayBuffer: async () => new TextEncoder().encode("data: hi\n\n").buffer.slice(0),
    });
    const sse = await runHandler(sseFetch, {
      headers: { "x-relay-target": "https://api.example.com", "x-relay-path": "/v1/chat", "x-relay-secret": SECRET },
      httpMethod: "POST",
      body: "x",
    });
    expect(sse.body).toBe("data: hi\n\n");
    expect(sse.isBase64Encoded).toBe(false);

    // Binary returns base64 with the flag set; whole shape stays JSON-serializable.
    const binBytes = Uint8Array.from([137, 80, 78, 71]);
    const binFetch = async () => ({
      status: 200,
      headers: new Headers({ "content-type": "image/png" }),
      arrayBuffer: async () => binBytes.buffer.slice(0),
    });
    const bin = await runHandler(binFetch, {
      headers: { "x-relay-target": "https://h.test", "x-relay-path": "/bin", "x-relay-secret": SECRET },
      httpMethod: "GET",
    });
    expect(Buffer.from(bin.body, "base64").equals(Buffer.from(binBytes))).toBe(true);
    expect(bin.isBase64Encoded).toBe(true);
    expect(() => JSON.stringify(bin)).not.toThrow();
  });

  it("builds the relay URL from the site URL", () => {
    expect(net.buildRelayUrl("https://foo.netlify.app/")).toBe(
      "https://foo.netlify.app/.netlify/functions/relay"
    );
  });

  it("builds a structurally valid stored zip with matching digests", () => {
    const { zip, sha256 } = net.buildRelayFunctionZip("zip-secret");
    const { sha1 } = net.buildIndexFile();
    expect(sha256).toHaveLength(64);
    expect(sha1).toHaveLength(40);

    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    expect(view.getUint32(0, true)).toBe(0x04034b50); // local file header
    const nameLen = view.getUint16(26, true);
    const size = view.getUint32(18, true);
    const name = Buffer.from(zip.subarray(30, 30 + nameLen)).toString("utf8");
    expect(name).toBe("relay.js");
    const content = zip.subarray(30 + nameLen, 30 + nameLen + size);
    expect(content.length).toBe(size);
    // CRC32 in header matches recomputation over the stored content.
    expect(view.getUint32(14, true)).toBe(net.crc32(content));
    expect(Buffer.from(content).toString("utf8")).toBe(net.buildNetlifyRelayFunctionCode("zip-secret"));
  });

  it("pollDeployReady resolves on ready and throws on error/timeout", async () => {
    const ready = await net.pollDeployReady(
      "d1", "tok",
      async () => ({ json: async () => ({ state: "ready", id: "d1" }) }),
      5000, 5
    );
    expect(ready.id).toBe("d1");

    await expect(
      net.pollDeployReady(
        "d1", "tok",
        async () => ({ json: async () => ({ state: "error", error_message: "boom" }) }),
        5000, 5
      )
    ).rejects.toThrow("boom");

    await expect(
      net.pollDeployReady(
        "d1", "tok",
        async () => ({ json: async () => ({ state: "building" }) }),
        30, 5
      )
    ).rejects.toThrow(/timed out/);
  });
});

describe("POST /api/proxy-pools/netlify-deploy", () => {
  it("rejects a missing token with 400 without calling Netlify", async () => {
    stubFetch(async () => { throw new Error("must not call Netlify"); });
    const res = await POST(postRoute({ projectName: "x" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/token/i);
    expect(createProxyPool).not.toHaveBeenCalled();
  });

  it("runs the digest-deploy flow and creates a netlify pool with a shared secret", async () => {
    const { sha1: idxSha } = net.buildIndexFile();
    let fnSha = null;
    const seen = [];

    stubFetch(async (url, init = {}) => {
      seen.push({ url, method: init.method });
      if (url === "https://api.netlify.com/api/v1/sites") {
        expect(JSON.parse(init.body).name).toBe("netlify-relay");
        return { ok: true, status: 201, json: async () => ({ id: "site_1", ssl_url: "https://relay-x.netlify.app" }) };
      }
      if (url === "https://api.netlify.com/api/v1/sites/site_1/deploys") {
        const body = JSON.parse(init.body);
        expect(body.files).toEqual({ "/index.html": idxSha });
        // The function digest is secret-dependent (random per deploy) — capture it.
        expect(body.functions.relay).toMatch(/^[0-9a-f]{64}$/);
        fnSha = body.functions.relay;
        return { ok: true, status: 200, json: async () => ({ id: "deploy_1", required: [idxSha], required_functions: [fnSha] }) };
      }
      if (url.includes("/files/index.html")) return { ok: true, status: 200, json: async () => ({}) };
      if (url.includes("/functions/relay?runtime=js")) {
        // The uploaded bundle embeds the per-deployment secret.
        const zipText = Buffer.from(await init.body).toString("latin1");
        expect(zipText).toContain("RELAY_SECRET");
        return { ok: true, status: 200, json: async () => ({}) };
      }
      if (url === "https://api.netlify.com/api/v1/deploys/deploy_1") {
        return { ok: true, status: 200, json: async () => ({ state: "ready", id: "deploy_1" }) };
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const res = await POST(postRoute({ netlifyToken: "nfp_test", projectName: "Netlify-Relay!!" }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.deployUrl).toBe("https://relay-x.netlify.app/.netlify/functions/relay");
    expect(createProxyPool).toHaveBeenCalledWith(expect.objectContaining({
      name: "netlify-relay",
      proxyUrl: "https://relay-x.netlify.app/.netlify/functions/relay",
      type: "netlify",
      relaySecret: expect.any(String),
    }));
    expect(data.proxyPool.relaySecret).toEqual(expect.any(String));
    expect(seen.map((s) => `${s.method || "GET"} ${s.url}`)).toEqual([
      "POST https://api.netlify.com/api/v1/sites",
      "POST https://api.netlify.com/api/v1/sites/site_1/deploys",
      "PUT https://api.netlify.com/api/v1/deploys/deploy_1/files/index.html",
      "PUT https://api.netlify.com/api/v1/deploys/deploy_1/functions/relay?runtime=js",
      "GET https://api.netlify.com/api/v1/deploys/deploy_1",
    ]);
  });

  it("skips uploads Netlify already has and maps a taken name to 409", async () => {
    stubFetch(async (url) => {
      if (url === "https://api.netlify.com/api/v1/sites") {
        return { ok: true, status: 201, json: async () => ({ id: "s1", ssl_url: "https://a.netlify.app" }) };
      }
      if (url === "https://api.netlify.com/api/v1/sites/s1/deploys") {
        return { ok: true, status: 200, json: async () => ({ id: "d1", required: [], required_functions: [] }) };
      }
      if (url === "https://api.netlify.com/api/v1/deploys/d1") {
        return { ok: true, status: 200, json: async () => ({ state: "ready", id: "d1" }) };
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    const res = await POST(postRoute({ netlifyToken: "nfp_test" }));
    expect(res.status).toBe(201);

    stubFetch(async (url) => {
      if (url === "https://api.netlify.com/api/v1/sites") {
        return { ok: false, status: 422, json: async () => ({ message: "name taken" }) };
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    const taken = await POST(postRoute({ netlifyToken: "nfp_test", projectName: "taken" }));
    expect(taken.status).toBe(409);
    expect((await taken.json()).error).toMatch(/different name/i);
  });
});

describe("netlify pool proxy resolution", () => {
  it("routes a netlify pool through the relay branch", async () => {
    getProxyPoolById.mockResolvedValue({
      id: "n1", isActive: true,
      proxyUrl: "https://relay-x.netlify.app/.netlify/functions/relay",
      type: "netlify", strictProxy: false,
      relaySecret: "pool-secret",
    });
    const cfg = await resolveConnectionProxyConfig({ proxyPoolId: "n1" });
    expect(cfg.source).toBe("netlify");
    expect(cfg.vercelRelayUrl).toBe("https://relay-x.netlify.app/.netlify/functions/relay");
    expect(cfg.connectionProxyEnabled).toBe(false);
    expect(cfg.relaySecret).toBe("pool-secret");
  });
});
