import { applyMarker } from "../utils.mjs";

/**
 * roadmap plugin — inserts/updates PROJECT_VERSION, PROJECT_STATUS, CURRENT_PHASE
 * markers in 14-roadmap.md inside the status-section heading.
 *
 * Anchor is matched case-insensitively across six languages so the plugin works
 * even if the roadmap heading is translated.
 */

// Match the status-section heading in Russian, English, Spanish, Chinese, French, German.
const ANCHOR = /^##\s+(\u0422\u0435\u043a\u0443\u0449\u0438\u0439 \u0441\u0442\u0430\u0442\u0443\u0441|Current Status|Estado actual|\u5f53\u524d\u72b6\u6001|Statut actuel|Projektstatus)\s*$/i;

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
