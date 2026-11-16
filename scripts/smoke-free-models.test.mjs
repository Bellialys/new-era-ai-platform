import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractFreeModels, parseLimit, checkOneModel } from "./smoke-free-models.mjs";

describe("bounded free-model inference smoke helper", () => {
  it("extracts only unique free IDs", () => {
    assert.deepEqual(extractFreeModels('id: "abc/one:free", id: "xyz/two:free"'), ["abc/one:free", "xyz/two:free"]);
    assert.throws(() => extractFreeModels('id: "paid/model"'));
    assert.throws(() => extractFreeModels('id: "a:free", id: "a:free"'));
  });
  it("limits manual request count to 1..11", () => {
    assert.equal(parseLimit(["--limit=2"], 11), 2);
    assert.equal(parseLimit([], 11), 11);
    assert.throws(() => parseLimit(["--limit=12"], 11));
    assert.throws(() => parseLimit(["--limit=0"], 11));
  });
  it("returns safe categorized provider statuses without a response payload", async () => {
    const rate = await checkOneModel("a:free", "secret", async () => ({ ok: false, status: 429 }));
    assert.deepEqual(rate, { status: "RATE_LIMIT" });
    const gone = await checkOneModel("a:free", "secret", async () => ({ ok: false, status: 404 }));
    assert.deepEqual(gone, { status: "NOT_FOUND" });
    const success = await checkOneModel("a:free", "secret", async () => ({
      ok: true, json: async () => ({ choices: [{ message: { content: " OK " } }] }),
    }));
    assert.deepEqual(success, { status: "OK" });
    const empty = await checkOneModel("a:free", "secret", async () => ({
      ok: true, json: async () => ({ choices: [{ message: { content: "" } }] }),
    }));
    assert.deepEqual(empty, { status: "EMPTY_RESPONSE" });
  });
});
