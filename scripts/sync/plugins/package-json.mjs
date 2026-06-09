/**
 * Keeps package.json "version" in lockstep with state.currentVersion.
 * Only rewrites the file when the version actually changes, to avoid
 * reformatting churn. Does not use SYNC markers (JSON has no comments).
 */
const packageJsonPlugin = {
  id: "package-json",
  path: "package.json",
  markers: [],

  apply(content, ctx) {
    const pkg = JSON.parse(content);
    const target = ctx.state.currentVersion;

    if (pkg.version === target) {
      return { content, changes: [] };
    }

    pkg.version = target;
    return {
      content: JSON.stringify(pkg, null, 2) + "\n",
      changes: [`version -> ${target}`],
    };
  },
};

export default packageJsonPlugin;
