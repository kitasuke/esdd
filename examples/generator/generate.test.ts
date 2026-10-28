import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXAMPLE, generate, loadInputs, resolve } from "./generate.ts";

const inputs = () => loadInputs(EXAMPLE.ir, EXAMPLE.bindings, EXAMPLE.steps);

describe("example generator", () => {
  it("the committed files are exactly what the generator produces", () => {
    for (const [path, body] of generate(inputs())) {
      expect(readFileSync(join(EXAMPLE.out, path), "utf8"), path).toBe(body);
    }
  });

  it("stops on a phrase with no step definition, naming every one", () => {
    const i = inputs();
    delete i.steps.outcomes['the order status shows "Packed"'];
    delete i.steps.events.complete;
    expect(() => resolve(i)).toThrow(/outcome: the order status shows "Packed"[\s\S]*event: complete/);
  });

  it("puts a given that disagrees with the path on the question list", () => {
    const sc003 = resolve(inputs()).find((f) => f.node === "SC-003");
    expect(sc003?.questions).toEqual([
      'given "one packed order exists" describes PACKED, but the path starts at PLACED — the path is walked',
    ]);
  });

  it("renders no test for a race whose outcome cannot be asserted", () => {
    const integration = generate(inputs()).get("order-cancel.integration.ts") ?? "";
    expect(integration).toContain("__RACE-PLACED-pack-cancel-outcome ");
    expect(integration).not.toContain("__RACE-PACKED-hand_over-cancel-outcome ");
  });
});
