import { applyMarker } from "../utils.mjs";

/**
 * agents plugin — inserts/updates PROJECT_VERSION and CURRENT_PHASE markers
 * in AGENTS.md inside the project-status heading.
 *
 * Anchor is matched case-insensitively across six languages so the plugin works
 * even if the AGENTS heading is translated.
 */

// Match the project-status heading in Russian, English, Spanish, German, French, Chinese.
const ANCHOR = /^##\s+(\u0422\u0435\u043a\u0443\u0449\u0438\u0439 \u0441\u0442\u0430\u0442\u0443\u0441 \u043f\u0440\u043e\u0435\u043a\u0442\u0430|Current Project Status|Estado actual del proyecto|Aktueller Projektstatus|Statut actuel du projet|\u9879\u76ee\u5f53\u524d\u72b6\u6001)\s*$/i;

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
