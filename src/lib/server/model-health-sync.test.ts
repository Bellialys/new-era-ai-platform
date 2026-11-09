import { describe, expect, it, vi } from "vitest";
import {
  extractText,
  isEligibleFreeTextModel,
  probeFreeModel,
  selectHealthTargets,
  shouldProbe,
  transitionHealth,
  type CatalogRow,
} from "./model-health-sync";

const TODAY = new Date("2026-11-09T03:17:00.000Z");

function listing(id = "google/working-model:free") {
  return {
    id,
    name: "Working Model",
    context_length: 16384,
    architecture: { output_modalities: ["text"], input_modalities: ["text"] },
    pricing: { prompt: "0", completion: "0", request: "0" },
    created: 2000,
  };
}

function row(
  key: string,
  active = true,
  meta: Record<string, unknown> = {},
  updatedAt = "2026-11-01T00:00:00.000Z",
): CatalogRow {
  return {
    id: key,
    model_key: key,
    display_name: key,
    is_active: active,
    is_public: active,
    price_label: "free",
    updated_at: updatedAt,
    raw_metadata: meta,
  };
}

describe("free OpenRouter model catalog eligibility", () => {
  it("accepts a zero-priced text chat free variant", () => {
    expect(isEligibleFreeTextModel(listing(), TODAY)).toBe(true);
  });

  it("never admits paid, non-free, image-only or ambiguous-price variants", () => {
    expect(isEligibleFreeTextModel({ ...listing(), id: "google/paid" }, TODAY)).toBe(false);
    expect(isEligibleFreeTextModel({
      ...listing(), pricing: { prompt: "0.01", completion: "0" },
    }, TODAY)).toBe(false);
    expect(isEligibleFreeTextModel({
      ...listing(), architecture: { output_modalities: ["image"] },
    }, TODAY)).toBe(false);
    expect(isEligibleFreeTextModel({ ...listing(), pricing: undefined }, TODAY)).toBe(false);
    expect(isEligibleFreeTextModel({
      ...listing(), pricing: { prompt: "0", completion: "0", request: "1" },
    }, TODAY)).toBe(false);
  });

  it("rejects expired and very-small-context listings", () => {
    expect(isEligibleFreeTextModel({
      ...listing(), expiration_date: "2026-11-08",
    }, TODAY)).toBe(false);
    expect(isEligibleFreeTextModel({
      ...listing(), context_length: 512,
    }, TODAY)).toBe(false);
  });
});

describe("health state transitions", () => {
  it("does not disable on the first hard failure; disables on the second", () => {
    const first = transitionHealth(row("google/test:free"), "NOT_FOUND", TODAY.toISOString());
    expect(first.is_active).toBe(true);
    expect(first.raw_metadata.auto_health).toMatchObject({
      failure_streak: 1, last_status: "NOT_FOUND",
    });
    const second = transitionHealth(first, "NOT_FOUND", "2026-11-10T03:17:00Z");
    expect(second.is_active).toBe(false);
    expect(second.is_public).toBe(false);
  });

  it("never disables an otherwise active model for rate limit or timeout", () => {
    const first = transitionHealth(row("google/test:free"), "NOT_FOUND", TODAY.toISOString());
    const rateLimited = transitionHealth(first, "RATE_LIMIT", "2026-11-10T03:17:00Z");
    const timedOut = transitionHealth(rateLimited, "TIMEOUT", "2026-11-11T03:17:00Z");
    expect(timedOut.is_active).toBe(true);
    expect(timedOut.raw_metadata.auto_health).toMatchObject({ failure_streak: 1 });
  });

  it("requires two clean responses to reactivate a quarantined model", () => {
    const first = transitionHealth(row(
      "google/test:free", false, { verification_retest_required: true },
    ), "OK", TODAY.toISOString());
    expect(first.is_active).toBe(false);
    const second = transitionHealth(first, "OK", "2026-11-10T03:17:00Z");
    expect(second.is_active).toBe(true);
    expect(second.is_public).toBe(true);
    expect(second.raw_metadata.verification_retest_required).toBe(false);
  });

  it("disables nonfree variants immediately and never promotes on the first success", () => {
    const off = transitionHealth(row("google/test:free"), "NOT_FREE", TODAY.toISOString());
    expect(off.is_active).toBe(false);
    const pending = transitionHealth(
      row("google/new:free", false, {
        auto_health: { discovered: true, state: "pending" },
      }),
      "OK", TODAY.toISOString(),
    );
    expect(pending.is_active).toBe(false);
    expect(pending.raw_metadata.auto_health).toMatchObject({
      state: "pending", success_streak: 1,
    });
  });

  it("does not re-probe the same model before 20 hours", () => {
    const m = row("google/test:free", true, {
      auto_health: { checked_at: "2026-11-09T02:17:00Z" },
    });
    expect(shouldProbe(m, TODAY)).toBe(false);
    expect(shouldProbe(m, new Date("2026-11-10T03:17:00Z"))).toBe(true);
    expect(shouldProbe(row("google/test:free", true, { auto_health_exempt: true }), TODAY)).toBe(false);
  });
});

describe("discovery prioritization and safety", () => {
  it("limits daily probes and rotates healthy candidates", () => {
    const rows = Array.from({ length: 8 }, (_, i) => row("google/active-" + i + ":free"));
    const quarantine = row("google/quarantined:free", false, {
      verification_retest_required: true,
    });
    const candidates = [listing("google/unknown-new:free")];
    const result = selectHealthTargets([...rows, quarantine], candidates, TODAY);
    expect(result.active).toHaveLength(3);
    expect(result.quarantined).toHaveLength(1);
    expect(result.fresh).toHaveLength(1);
    expect(result.pending).toHaveLength(0);
  });

  it("probes pending discovery instead of inserting duplicates", () => {
    const pending = row("google/pending:free", false, {
      auto_health: { discovered: true, managed: true, state: "pending" },
    });
    const result = selectHealthTargets(
      [pending], [listing("google/new-one:free")], TODAY,
    );
    expect(result.pending).toHaveLength(1);
    expect(result.fresh).toHaveLength(0);
  });

  it("does not automatically reactivate deliberate historical disabled rows", () => {
    const manuallyDisabled = row("google/disabled:free", false);
    const result = selectHealthTargets(
      [manuallyDisabled], [listing("google/disabled:free")], TODAY,
    );
    expect(result.quarantined).toHaveLength(0);
    expect(result.fresh).toHaveLength(0);
  });

  it("only auto-discovers from the explicit provider allowlist", () => {
    const result = selectHealthTargets([], [
      listing("unknown-provider/new-model:free"),
    ], TODAY);
    expect(result.fresh).toHaveLength(0);
  });
});

describe("bounded inference probe", () => {
  it("accepts text content and rejects empty content", () => {
    expect(extractText({ choices: [{ message: { content: " OK " } }] })).toBe("OK");
    expect(extractText({ choices: [{ message: { content: [
      { type: "text", text: " OK" }, { type: "image", text: "invisible" },
    ] } }] })).toBe("OK");
    expect(extractText({ choices: [{ message: { content: "" } }] })).toBe("");
  });

  it("never sends a paid model to the provider", async () => {
    const fake = vi.fn();
    const outcome = await probeFreeModel("google/paid-model", "dummy", fake as typeof fetch);
    expect(outcome).toBe("NOT_FREE");
    expect(fake).not.toHaveBeenCalled();
  });

  it("distinguishes a valid answer, 429, 404, and 401", async () => {
    const ok = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: "OK" } }],
    }), { status: 200 }));
    expect(await probeFreeModel("google/test:free", "dummy", ok as typeof fetch)).toBe("OK");
    const args = ok.mock.calls[0] as unknown as [string, RequestInit];
    expect(args[0]).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(JSON.parse(String(args[1].body)).model).toBe("google/test:free");
    for (const [code, status] of [[429, "RATE_LIMIT"], [404, "NOT_FOUND"], [401, "AUTH_ERROR"]] as const) {
      const fake = vi.fn().mockResolvedValue(new Response(null, { status: code }));
      expect(await probeFreeModel("google/test:free", "dummy", fake as typeof fetch)).toBe(status);
    }
  });
});
