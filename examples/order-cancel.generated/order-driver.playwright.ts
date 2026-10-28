// The single adapter from IR vocabulary to the screen. Locators and copy come from the
// bindings file only; routes and widget quirks (implementation vocabulary) live here and
// nowhere else. Integration and E2E share this adapter.
import { readFileSync } from "node:fs";
import { expect, type Locator, type Page } from "@playwright/test";
import { parse } from "yaml";
import type { OrderDriver } from "./order-driver.ts";

type Element = { role?: Parameters<Page["getByRole"]>[0]; name?: string; label?: string; testid?: string; text?: string };
type Bindings = { elements: Record<string, Element>; literals: Record<string, string> };

const bindings: Bindings = parse(readFileSync(new URL("../order-cancel.bindings.yaml", import.meta.url), "utf8"));

function literal(key: string): string {
  const text = bindings.literals[key];
  if (text === undefined) throw new Error(`no literal ${key} in bindings`);
  return text;
}

function locate(page: Page, id: string): Locator {
  const e = bindings.elements[id];
  if (e === undefined) throw new Error(`no element ${id} in bindings`);
  if (e.role !== undefined) return page.getByRole(e.role, { name: e.name, exact: true });
  if (e.label !== undefined) return page.getByLabel(e.label, { exact: true });
  if (e.testid !== undefined) return page.getByTestId(e.testid);
  return page.getByText(e.text ?? "", { exact: true });
}

export function orderDriver(page: Page): OrderDriver {
  const status = () => locate(page, "order_status");
  return {
    // The route is the application's, not the IR's
    open: async (orderId, actor) => {
      await page.goto(`/${actor}/orders/${orderId}`);
    },
    pack: () => locate(page, "pack_button").click(),
    handOver: () => locate(page, "hand_over_button").click(),
    cancel: () => locate(page, "cancel_button").click(),
    refresh: async () => {
      await page.reload();
    },
    expectStatus: (key) => expect(status()).toHaveText(literal(key)),
    expectStatusNot: (key) => expect(status()).not.toHaveText(literal(key)),
    expectFeeNotice: () => expect(locate(page, "fee_notice")).toHaveText(literal("cancellation_fee_notice")),
    expectNoFeeNotice: () => expect(locate(page, "fee_notice")).toBeHidden(),
  };
}
