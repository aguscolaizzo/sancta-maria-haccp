import assert from "node:assert/strict";
import { test } from "node:test";
import { findOpenFoodFactsProduct } from "../lib/open-food-facts.ts";

test("a slow Open Food Facts response is aborted within the configured limit", async () => {
  const startedAt = Date.now();
  const result = await findOpenFoodFactsProduct(
    "9912345678947",
    "09912345678947",
    {
      timeoutMs: 40,
      fetcher: async (_input, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true },
          );
        }),
    },
  );
  assert.equal(result.status, "timeout");
  assert.ok(Date.now() - startedAt < 500);
});

test("external server errors are reported without throwing", async () => {
  const result = await findOpenFoodFactsProduct(
    "9912345678954",
    "09912345678954",
    {
      fetcher: async () => new Response("upstream error", { status: 503 }),
    },
  );
  assert.deepEqual(result, { status: "unavailable", diagnostic: "HTTP 503" });
});
