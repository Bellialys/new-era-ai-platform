import { applyMarker } from "../utils.mjs";

/**
 * changelog plugin — inserts/updates the PROJECT_VERSION marker
 * in 15-changelog.md inside the current-version heading.
 *
 * Anchor is matched case-insensitively across six languages so the plugin works
 * even if the changelog heading is translated.
 */

// Match the version heading in Russian, English, German, French, Spanish, Chinese.
const ANCHOR = /^##\s+(\u0422\u0435\u043a\u0443\u0449\u0430\u044f \u0432\u0435\u0440\u0441\u0438\u044f|Current Version|Aktuelle Version|Version actuelle|Versi\u00f3n actual|\u5f53\u524d\u7248\u672c)\s*$/i;

const changelogPlugin = {
  id: "changelog",
  path: "15-changelog.md",
  markers: ["PROJECT_VERSION"],

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

export default changelogPlugin;
