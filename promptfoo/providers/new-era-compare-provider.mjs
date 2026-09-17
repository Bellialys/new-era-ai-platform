export default class NewEraCompareProvider {
  constructor(options = {}) {
    this.providerId = options.config?.providerId || options.id || "new-era-platform";
    this.config = options.config || {};
    this.guestCookie = null;
  }

  id() {
    return this.providerId;
  }

  resolveBaseUrl() {
    const rawBaseUrl =
      process.env.PROMPTFOO_TARGET_URL ||
      this.config.baseUrl ||
      "http://127.0.0.1:3000";

    const url = new URL(rawBaseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("PROMPTFOO_TARGET_URL must use http:// or https://");
    }

    const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
    const isLocal = localHosts.has(url.hostname);
    if (!isLocal && process.env.PROMPTFOO_ALLOW_REMOTE_TARGET !== "1") {
      throw new Error(
        "Remote Promptfoo targets are blocked by default. Set PROMPTFOO_ALLOW_REMOTE_TARGET=1 explicitly if you intend to test a remote deployment."
      );
    }

    return url.toString().replace(/\/+$/, "");
  }

  timeoutSignal() {
    const timeoutMs = Number(this.config.timeoutMs || 70_000);
    return AbortSignal.timeout(Number.isFinite(timeoutMs) ? timeoutMs : 70_000);
  }

  async readJson(response) {
    const text = await response.text();
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  }

  async ensureGuestSession(baseUrl) {
    if (this.guestCookie) {
      return;
    }

    const response = await fetch(`${baseUrl}/api/guest`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "User-Agent": "new-era-ai-promptfoo/1.0",
      },
      signal: this.timeoutSignal(),
    });

    const body = await this.readJson(response);
    if (response.status !== 200 && response.status !== 201) {
      throw new Error(
        `POST /api/guest failed with HTTP ${response.status}: ${JSON.stringify(body)}`
      );
    }

    const setCookie = response.headers.get("set-cookie");
    const match = setCookie?.match(/(?:^|,\s*)na_guest=([^;,\s]+)/);
    if (!match?.[1]) {
      throw new Error("POST /api/guest did not return the na_guest cookie.");
    }

    this.guestCookie = `na_guest=${match[1]}`;
  }

  async loadModelIds(baseUrl, headers) {
    const response = await fetch(`${baseUrl}/api/models`, {
      method: "GET",
      headers,
      signal: this.timeoutSignal(),
    });
    const body = await this.readJson(response);

    if (response.status !== 200 || body?.status !== "success") {
      throw new Error(
        `GET /api/models failed with HTTP ${response.status}: ${JSON.stringify(body)}`
      );
    }

    const modelCount = Number(this.config.modelCount || 2);
    const models = Array.isArray(body.models) ? body.models : [];
    const selected = models
      .filter((model) => typeof model?.id === "string" && model.id.length > 0)
      .slice(0, modelCount);

    if (selected.length < modelCount) {
      throw new Error(
        `GET /api/models returned ${selected.length} usable models; ${modelCount} required.`
      );
    }

    return selected.map((model) => model.id);
  }

  summarizeModelResponses(body) {
    const responses = Array.isArray(body?.responses) ? body.responses : [];
    const modelSuccessCount = responses.filter((item) => item?.status === "success").length;
    const modelFailures = responses
      .filter((item) => item?.status === "error")
      .map((item) => ({
        modelId: typeof item?.modelId === "string" ? item.modelId : null,
        modelName: typeof item?.modelName === "string" ? item.modelName : null,
        errorCode: typeof item?.errorCode === "string" ? item.errorCode : null,
        errorMessage: typeof item?.errorMessage === "string" ? item.errorMessage : null,
      }));

    return {
      modelSuccessCount,
      modelFailureCount: modelFailures.length,
      modelFailures,
    };
  }

  async callApi(prompt, context = {}) {
    try {
      const baseUrl = this.resolveBaseUrl();
      const authMode = this.config.authMode || "guest";
      const vars = context.vars || {};

      if (authMode !== "guest" && authMode !== "none") {
        throw new Error(`Unsupported authMode: ${authMode}`);
      }

      if (authMode === "guest") {
        await this.ensureGuestSession(baseUrl);
      }

      const headers = {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "new-era-ai-promptfoo/1.0",
        "x-request-id": `promptfoo-${crypto.randomUUID()}`,
      };

      if (this.guestCookie) {
        headers.Cookie = this.guestCookie;
      }

      const explicitModelIds = Array.isArray(vars.modelIds)
        ? vars.modelIds.map((value) => String(value))
        : null;

      const selectedModelIds =
        explicitModelIds && explicitModelIds.length > 0
          ? explicitModelIds
          : authMode === "none"
            ? ["promptfoo-model-a", "promptfoo-model-b"]
            : await this.loadModelIds(baseUrl, headers);

      const requestPrompt =
        typeof vars.requestPrompt === "string" ? vars.requestPrompt : prompt;
      const modeSlug =
        Object.prototype.hasOwnProperty.call(vars, "modeSlug")
          ? vars.modeSlug
          : this.config.modeSlug || "prompt-arena";

      const response = await fetch(`${baseUrl}/api/compare`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          prompt: requestPrompt,
          modelIds: selectedModelIds,
          modeSlug,
          stream: false,
        }),
        signal: this.timeoutSignal(),
      });

      const body = await this.readJson(response);
      const modelSummary = this.summarizeModelResponses(body);

      return {
        output: {
          httpStatus: response.status,
          ...modelSummary,
          selectedModelIds,
          body,
        },
        prompt: requestPrompt,
        metadata: {
          authMode,
          target: `${baseUrl}/api/compare`,
          responseRequestId: response.headers.get("x-request-id"),
        },
      };
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Unknown New Era AI Promptfoo provider error",
      };
    }
  }
}
