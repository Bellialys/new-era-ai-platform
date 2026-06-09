import { applyMarker } from "../utils.mjs";

const ANCHOR = /^##\s+Текущий статус проекта\s*$/;

const agentsPlugin = {
  id: "agents",
  path: "AGENTS.md",
  markers: ["PROJECT_VERSION", "CURRENT_PHASE"],

  apply(content, ctx) {
    const changes = [];
    let next = content;
    for (const name of this.markers) {
      const result = applyMarker(next, name, ctx.markers[name], ANCHOR);
      next = result.content;
      if (result.changed) changes.push(`${name}${result.inserted ? " (inserted)" : ""}`);
    }
    return { content: next, changes };
  },
};

export default agentsPlugin;
