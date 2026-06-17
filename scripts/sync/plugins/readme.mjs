import { applyMarker } from "../utils.mjs";

/**
 * readme plugin — inserts/updates PROJECT_VERSION, PROJECT_STATUS, CURRENT_PHASE
 * markers in README.md inside the status-section heading.
 *
 * Anchor is matched case-insensitively across six languages so the plugin works
 * even if the README heading is translated.
 */

// Match the status-section heading in Russian, English, Spanish, Chinese, French, German.
const ANCHOR = /^##\s+(Текущий статус|Current Status|Estado actual|当前状态|Statut actuel|Projektstatus)\s*$/i;

const readmePlugin = {
  id: "readme",
  path: "README.md",
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

export default readmePlugin;
