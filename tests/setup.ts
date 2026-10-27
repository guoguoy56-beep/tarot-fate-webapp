import { afterEach, beforeEach, expect, vi } from "vitest";

let unexpectedFetch: ReturnType<typeof vi.fn<typeof fetch>>;

beforeEach(() => {
  vi.stubEnv("DEEPSEEK_READING_ENABLED", "false");
  vi.stubEnv("DEEPSEEK_API_KEY", "");
  unexpectedFetch = vi.fn<typeof fetch>(async () => {
    throw new Error("External fetch is disabled in automated tests; install an explicit mock.");
  });
  vi.stubGlobal("fetch", unexpectedFetch);
});

afterEach(() => {
  // Fail even when application code catches the rejected fetch.
  expect(unexpectedFetch).not.toHaveBeenCalled();
});
