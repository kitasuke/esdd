// A stand-in for the real order backend, for the API graph walk example. Written by hand, not from
// the IR: it keeps every order it has created and answers GraphQL-shaped requests, so a walk against
// it is a walk against something with its own rules and memory, like a real system.
// Tests pass `allowed` to plant a defect in its rules.

export type OrderStatus = "PLACED" | "PACKED" | "HANDED_OVER" | "COMPLETED" | "CANCELED";

export type Response =
  | { data: { order: { id: string; status: OrderStatus } } }
  | { status: number; errors: { message: string; extensions?: { code: string } }[] };

export type Rules = Record<string, { from: OrderStatus[]; to: OrderStatus }>;

export const RULES: Rules = {
  PackOrder: { from: ["PLACED"], to: "PACKED" },
  HandOverOrder: { from: ["PACKED"], to: "HANDED_OVER" },
  CancelOrder: { from: ["PLACED", "PACKED"], to: "CANCELED" },
};

export interface OrderService {
  handle(request: { operationName: string; variables: { id: string } }): Response;
  /** A new paid order (PLACED) */
  create(): string;
  /** Test data: a new order stored directly in the status, without the operations that lead there */
  seed(status: OrderStatus): string;
  /** The carrier's delivery report (not an operation of this API) */
  completeDelivery(id: string): void;
}

export function orderService(options: { rules?: Rules; down?: string[] } = {}): OrderService {
  const rules = options.rules ?? RULES;
  const orders = new Map<string, OrderStatus>();
  let nextId = 1;
  const seed = (status: OrderStatus) => {
    const id = `order-${nextId++}`;
    orders.set(id, status);
    return id;
  };
  return {
    handle: ({ operationName, variables: { id } }) => {
      if (options.down?.includes(operationName)) return { status: 503, errors: [{ message: "unavailable" }] };
      const status = orders.get(id);
      if (status === undefined) return { status: 200, errors: [{ message: "no such order", extensions: { code: "NOT_FOUND" } }] };
      if (operationName === "Order") return { data: { order: { id, status } } };
      const rule = rules[operationName];
      if (rule === undefined) return { status: 400, errors: [{ message: `unknown operation ${operationName}` }] };
      if (!rule.from.includes(status)) {
        return { status: 200, errors: [{ message: `cannot ${operationName} an order in ${status}`, extensions: { code: "INVALID_STATE" } }] };
      }
      orders.set(id, rule.to);
      return { data: { order: { id, status: rule.to } } };
    },
    create: () => seed("PLACED"),
    seed,
    completeDelivery: (id) => {
      if (orders.get(id) === "HANDED_OVER") orders.set(id, "COMPLETED");
    },
  };
}
