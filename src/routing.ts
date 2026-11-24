// Routing file checks (docs/routing.md): the file that says, before generation, which platforms a
// change has work on, in what order, and on what evidence. The checks are structural: they cannot
// tell whether the evidence is right, only that the file is complete and consistent with itself.

import { config } from "./config.ts";
import type { Finding } from "./types.ts";

export const VERDICTS = ["client-only", "server-first", "no-client", "blocked"] as const;
export const KINDS = ["contract", "implementation", "decision", "verification"] as const;
export const NEED_STATUSES = ["exists", "missing", "stub", "differs"] as const;
export const WORK_STATUSES = ["todo", "in-progress", "done", "deferred", "pending"] as const;

export interface RoutingPlatforms {
  platforms: string[];
  server: string[];
  client: string[];
  verification: string;
}

export function routingPlatforms(): RoutingPlatforms {
  const r = config().routing ?? {};
  return {
    platforms: r.platforms ?? ["backend", "codegen", "web", "android", "ios", "e2e"],
    server: r.server ?? ["backend"],
    client: r.client ?? ["web"],
    verification: r.verification ?? "e2e",
  };
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const objs = (v: unknown): Obj[] => list(v).filter(isObj);
const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
const oneOf = (values: readonly string[]) => values.join(" | ");

/** `done (abc123)` → { state: "done", note: "abc123" } */
export function parseWorkStatus(raw: unknown): { state: string; note: string } | undefined {
  const m = /^\s*([a-z-]+)\s*(?:\(\s*(.*?)\s*\))?\s*$/s.exec(str(raw));
  return m ? { state: m[1]!, note: m[2] ?? "" } : undefined;
}

/** One cycle in depends_on, or undefined */
export function findCycle(edges: Map<string, string[]>): string[] | undefined {
  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];
  const visit = (n: string): string[] | undefined => {
    if (state.get(n) === "done") return undefined;
    if (state.get(n) === "visiting") return [...stack.slice(stack.indexOf(n)), n];
    state.set(n, "visiting");
    stack.push(n);
    for (const m of edges.get(n) ?? []) {
      if (!edges.has(m)) continue;
      const c = visit(m);
      if (c) return c;
    }
    stack.pop();
    state.set(n, "done");
    return undefined;
  };
  for (const n of edges.keys()) {
    const c = visit(n);
    if (c) return c;
  }
  return undefined;
}

export function checkRouting(doc: unknown, platforms: RoutingPlatforms = routingPlatforms()): Finding[] {
  const out: Finding[] = [];
  const add = (check: string, message: string) => out.push({ level: "error", check: `routing-${check}`, message });
  if (!isObj(doc)) {
    add("shape", "the routing file is not a mapping");
    return out;
  }

  const verdict = str(doc["verdict"]);
  if (!(VERDICTS as readonly string[]).includes(verdict)) add("enum", `verdict "${verdict}" is not one of ${oneOf(VERDICTS)}`);
  for (const key of ["source", "verdict", "requirements", "work"]) if (doc[key] == null) add("shape", `${key} is missing`);
  if (doc["source"] != null && !isObj(doc["source"])) add("shape", "source is not a mapping");
  for (const key of ["requirements", "work", "questions", "feedback"]) {
    const v = doc[key];
    if (v == null) continue;
    if (!Array.isArray(v)) add("shape", `${key} is not a list`);
    else if (v.some((x) => !isObj(x))) add("shape", `${key} has an item that is not a mapping`);
  }

  const requirements = objs(doc["requirements"]);
  const work = objs(doc["work"]);
  const questions = objs(doc["questions"]);
  const feedback = objs(doc["feedback"]);

  const ids = (kind: string, items: Obj[]): Set<string> => {
    const seen = new Set<string>();
    for (const it of items) {
      const id = str(it["id"]);
      if (id === "") add("ids", `${kind} has an item without an id`);
      else if (seen.has(id)) add("ids", `${kind} id "${id}" is used twice`);
      seen.add(id);
    }
    return seen;
  };
  const reqIds = ids("requirements", requirements);
  const workIds = ids("work", work);
  ids("questions", questions);

  for (const r of requirements) {
    for (const n of objs(r["needs"])) {
      if (!(NEED_STATUSES as readonly string[]).includes(str(n["status"]))) {
        add("enum", `${str(r["id"])}: need "${str(n["target"])}" has status "${str(n["status"])}", not one of ${oneOf(NEED_STATUSES)}`);
      }
    }
  }

  const byId = new Map(work.map((w) => [str(w["id"]), w]));
  const statusOf = (w: Obj) => parseWorkStatus(w["status"])?.state ?? "";
  const platformOf = (w: Obj) => str(w["platform"]);
  for (const w of work) {
    const id = str(w["id"]);
    if (!platforms.platforms.includes(platformOf(w))) {
      add("enum", `${id}: platform "${platformOf(w)}" is not one of ${oneOf(platforms.platforms)}`);
    }
    if (!(KINDS as readonly string[]).includes(str(w["kind"]))) add("enum", `${id}: kind "${str(w["kind"])}" is not one of ${oneOf(KINDS)}`);
    const s = parseWorkStatus(w["status"]);
    if (!s || !(WORK_STATUSES as readonly string[]).includes(s.state)) {
      add("enum", `${id}: status "${str(w["status"])}" is not one of ${oneOf(WORK_STATUSES)}`);
    } else if (s.state === "pending" && platformOf(w) !== platforms.verification) {
      add("status", `${id}: pending is only for ${platforms.verification} work (an example no existing account can reach)`);
    } else if (s.state === "deferred" && s.note === "") {
      add("status", `${id} is deferred without who decided it; write "deferred (<who, why>)"`);
    } else if (s.state === "done" && s.note === "") {
      add("status", `${id} is done without a commit; write "done (<commit>)"`);
    } else if (s.state === "in-progress" && s.note === "") {
      add("status", `${id} is in progress without a change; write "in-progress (<change>)"`);
    }
    for (const f of list(w["from"])) if (!reqIds.has(str(f))) add("refs", `${id}: from "${str(f)}" is not a requirement id`);
    for (const d of list(w["depends_on"])) if (!workIds.has(str(d))) add("refs", `${id}: depends_on "${str(d)}" is not a work id`);
  }
  const cycle = findCycle(new Map(work.map((w) => [str(w["id"]), list(w["depends_on"]).map(str)])));
  if (cycle) add("cycle", `depends_on has a cycle: ${cycle.join(" → ")}`);

  for (const f of feedback) {
    for (const s of list(f["stopped"])) {
      if (!workIds.has(str(s))) add("refs", `feedback "${str(f["found"])}": stopped "${str(s)}" is not a work id`);
    }
    const r = f["resolved_as"];
    if (r != null && str(r) !== "not_routed" && !workIds.has(str(r))) {
      add("refs", `feedback "${str(f["found"])}": resolved_as "${str(r)}" is neither a work id nor not_routed`);
    }
  }

  for (const q of questions) {
    const options = objs(q["options"]);
    const optionIds = options.map((o) => str(o["id"]));
    if (options.length === 0) {
      // A question that does not split the routing (which test can tell the change apart) has no options; its proposal is text
      if (str(q["recommended"]).trim() === "") {
        add("recommended", `${str(q["id"])} has neither options nor recommended; give one option per routing outcome, or write the proposal in recommended`);
      }
    } else if (!optionIds.includes(str(q["recommended"]))) {
      add("recommended", `${str(q["id"])}: recommended "${str(q["recommended"])}" is not one of its options (${optionIds.join(", ")})`);
    }
    for (const o of options) {
      if (o["verdict"] != null && !(VERDICTS as readonly string[]).includes(str(o["verdict"]))) {
        add("enum", `${str(q["id"])} option ${str(o["id"])}: verdict "${str(o["verdict"])}" is not one of ${oneOf(VERDICTS)}`);
      }
    }
  }

  const live = work.filter((w) => statusOf(w) !== "deferred");
  const isServer = (w: Obj) => platforms.server.includes(platformOf(w));
  const isClient = (w: Obj) => platforms.client.includes(platformOf(w));
  const client = live.filter(isClient);
  const server = live.filter(isServer);
  /** Work reached through depends_on, transitively (server work behind a codegen step counts) */
  const reach = (w: Obj): Obj[] => {
    const seen = new Map<string, Obj>();
    const walk = (x: Obj) => {
      for (const d of list(x["depends_on"])) {
        const dep = byId.get(str(d));
        if (!dep || seen.has(str(dep["id"]))) continue;
        seen.set(str(dep["id"]), dep);
        walk(dep);
      }
    };
    walk(w);
    return [...seen.values()];
  };
  const waitsOnServer = (w: Obj) => reach(w).filter((d) => isServer(d) && statusOf(d) !== "done");

  if (verdict === "client-only") {
    for (const w of client) {
      for (const d of waitsOnServer(w)) {
        add("verdict", `verdict is client-only, but ${str(w["id"])} depends on ${str(d["id"])}, server work that is not done; make it server-first or give the reason the dependency does not hold`);
      }
    }
  }
  if (verdict === "server-first" && !client.some((w) => waitsOnServer(w).length > 0)) {
    add("verdict", "verdict is server-first, but no client work depends on server work that is not done");
  }
  if (verdict === "no-client" && client.length > 0) {
    add("verdict", `verdict is no-client, but there is client work (${client.map((w) => str(w["id"])).join(", ")})`);
  }
  if (verdict === "blocked" && questions.length === 0) {
    add("verdict", "verdict is blocked, but there are no questions; write what cannot be decided, each with a proposal");
  }

  if (server.length > 0 && client.length > 0) {
    const need = [...server, ...client].map((w) => str(w["id"]));
    const checks = live.filter((w) => platformOf(w) === platforms.verification && str(w["kind"]) === "verification");
    if (checks.length === 0) {
      add("verification", `there is server and client work, but no ${platforms.verification} verification work to run once both are out`);
    } else {
      const covered = new Set(checks.flatMap((w) => reach(w).map((d) => str(d["id"]))));
      const missing = need.filter((id) => !covered.has(id));
      if (missing.length > 0) {
        add("verification", `the ${platforms.verification} verification work does not depend on ${missing.join(", ")}; it waits for every server and client item`);
      }
    }
  }
  return out;
}
