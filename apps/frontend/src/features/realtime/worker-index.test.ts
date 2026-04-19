import { afterEach, describe, expect, test, vi } from "vitest";
import { createSseWorker } from "./worker-index";

describe("createSseWorker", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("returns null when Worker is unavailable", () => {
    vi.stubGlobal("Worker", undefined);
    expect(createSseWorker()).toBeNull();
  });
});
