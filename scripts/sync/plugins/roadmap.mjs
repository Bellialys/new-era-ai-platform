import { applyMarker } from "../utils.mjs";

const ANCHOR = /^##\s+Текущий статус\s*$/;

const roadmapPlugin = {
  id: "roadmap",
  path: "14-roadmap.md",
  markers: ["PROJECT_VERSION", "PROJECT_STATUS", "CURRENT_PHASE"],

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

export default roadmapPlugin;
