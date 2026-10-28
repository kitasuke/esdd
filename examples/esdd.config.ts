// Example project configuration (src/config.ts): pass it with --config.
//   npm run check -- examples/order-cancel.usecase.yaml --config examples/esdd.config.ts
import type { EsddConfig } from "../src/config.ts";

const config: EsddConfig = {
  // the actors this project's usecases may name; any other actor is a structure error
  actors: ["customer", "staff", "system"],
  // a marker the spec owners already write for open questions, counted like TBD
  pendingMarkers: ["OPEN QUESTION"],
  // a second locator vocabulary: elements addressed by a test tag, events by a command name
  platforms: {
    mobile: {
      elementKeys: ["testTag", "text", "note"],
      checkElement(id, e, findings) {
        if (typeof e.testTag === "string" && !/^[a-z][a-z0-9-]*$/.test(e.testTag)) {
          findings.push({ level: "error", check: "bindings-schema", message: `elements.${id}: testTag must be kebab-case: ${e.testTag}` });
        }
      },
      checkEvent(id, e, findings) {
        if (typeof e.command !== "string") {
          findings.push({ level: "error", check: "bindings-events", message: `events.${id}: command is required` });
        }
      },
    },
  },
  // the approval digest for approvers who read another wording
  digest: { states: "Lifecycle", races: "When two things happen at once" },
};

export default config;
