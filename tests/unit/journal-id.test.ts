import { afterEach, expect, test, vi } from "vitest";
import { createJournalId } from "@/lib/journal-id";

afterEach(() => vi.unstubAllGlobals());

test("keeps the native UUID API when it is available", () => {
  vi.stubGlobal("crypto", { randomUUID: () => "2b1badfc-adc3-4b86-b58c-c9fed8ee05d8" });
  expect(createJournalId()).toBe("2b1badfc-adc3-4b86-b58c-c9fed8ee05d8");
});

test("creates distinct version 4 journal IDs in an HTTP browser without randomUUID", () => {
  const getRandomValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
  vi.stubGlobal("crypto", { getRandomValues });
  const first = createJournalId(), second = createJournalId();
  expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(second).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(first).not.toBe(second);
});
