import { describe, expect, it, vi } from "vitest";
import { handleComboChat } from "../../open-sse/services/combo.js";

// Current combo contract (#5057): any request-scoped 4xx — credit/balance
// rejections AND generic validation 400s — advances to the next member,
// because the fault is with THIS member's validation, not the credential.
describe("combo credit fallback", () => {
  it.each([
    "You have insufficient credits to make this request.",
    "Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.",
    "Bad request",
  ])("400 (%s) advances to the next member", async (message) => {
    const body = { messages: [{ role: "user", content: "Hello" }] };
    const models = ["cmc/deepseek/deepseek-v4-pro", "mistral/mistral-medium-latest"];
    const failure = Response.json({ error: { message } }, { status: 400 });
    const success = Response.json({ choices: [{ message: { content: "Hello" } }] });
    const handleSingleModel = vi.fn()
      .mockResolvedValueOnce(failure)
      .mockResolvedValueOnce(success);

    const response = await handleComboChat({
      body, models, handleSingleModel,
      log: { info: vi.fn(), warn: vi.fn() },
      comboName: "credit-fallback", comboStrategy: "fallback",
    });

    expect(response).toBe(success);
    expect(handleSingleModel.mock.calls).toEqual(models.map((model) => [body, model]));
  });

  it("returns the FIRST request-scoped failure when every member rejects", async () => {
    const body = { messages: [{ role: "user", content: "Hello" }] };
    const models = ["cmc/deepseek/deepseek-v4-pro", "mistral/mistral-medium-latest"];
    const first = Response.json({ error: { message: "unsupported parameter" } }, { status: 400 });
    const second = Response.json({ error: { message: "context length exceeded" } }, { status: 400 });
    const handleSingleModel = vi.fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);

    const response = await handleComboChat({
      body, models, handleSingleModel,
      log: { info: vi.fn(), warn: vi.fn() },
      comboName: "credit-fallback", comboStrategy: "fallback",
    });

    // Not a synthetic 503 — the first member's 400 names the real cause.
    expect(response).toBe(first);
    expect(handleSingleModel.mock.calls).toEqual(models.map((model) => [body, model]));
  });
});
