import { randomBytes, randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const branch = "test/stage10-production-team-smoke-20261116";
const origin = "https://new-era-ai-platform.vercel.app";
const projectHost = "jbeecpbcsnowcaygteoj.supabase.co";
const roles = ["planner", "researcher", "critic", "finalizer"];

function assert(condition, label) {
  if (!condition) throw new VerificationFailure(label);
}

function log(check, fields = {}) {
  console.log("[stage10] " + JSON.stringify({ check, ...fields }));
}

function safeValue(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_.-]{1,110}$/.test(value) ? value : null;
}

function boundedFetch(input, init = {}) {
  const limit = AbortSignal.timeout(12_000);
  const signal = init.signal ? AbortSignal.any([init.signal, limit]) : limit;
  return fetch(input, { ...init, signal });
}

async function verify() {
  assert(process.env.VERCEL_ENV === "preview", "Preview required");
  assert(process.env.VERCEL_GIT_COMMIT_REF === branch, "Dedicated branch required");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert(url && new URL(url).origin === "https://" + projectHost, "Expected Supabase project");
  assert(publicKey && serviceKey, "Required Vercel variables unavailable");

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: boundedFetch },
  });
  const { data: journal, error: journalError } = await admin
    .from("model_health_runs")
    .select("run_date,source,status")
    .limit(1);
  log("journal-data-api", { accessible: !journalError, exampleRows: journal?.length, code: safeValue(journalError?.code) });
  assert(!journalError, "Cannot read the production journal over the Data API");

  const run = randomUUID();
  const email = "stage10-" + run + "@example.com";
  const password = "S10!a" + randomBytes(24).toString("base64url");
  const task = "Stage 10 release smoke " + run + ". What is 7 + 5? Explain the calculation briefly.";
  const cookiesByName = new Map();
  const session = createServerClient(url, publicKey, {
    global: { fetch: boundedFetch },
    cookies: {
      getAll: () => [...cookiesByName.entries()].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        for (const { name, value } of cookies) {
          if (value) cookiesByName.set(name, value);
          else cookiesByName.delete(name);
        }
      },
    },
  });
  let fixtureId;
  let signedIn = false;

  try {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { purpose: "stage10-release-smoke", fixture_run: run },
    });
    if (created.error) {
      const message = created.error.message || "";
      log("fixture-creation-error", {
        code: safeValue(created.error.code),
        http: created.error.status,
        field: /password/i.test(message) ? "password" : /email/i.test(message) ? "email" : null,
      });
    }
    assert(!created.error && created.data.user, "Could not create the smoke fixture");
    fixtureId = created.data.user.id;
    log("fixture-created", { fixtureId, run });

    const login = await session.auth.signInWithPassword({ email, password });
    signedIn = Boolean(login.data.session);
    if (login.error) log("fixture-sign-in-error", { code: safeValue(login.error.code), http: login.error.status });
    assert(!login.error && signedIn && login.data.user?.id === fixtureId, "Fixture sign-in failed");
    assert(cookiesByName.size > 0, "Supabase SSR did not set session cookies");
    const cookie = [...cookiesByName.entries()].map(([name, value]) => name + "=" + encodeURIComponent(value)).join("; ");

    const models = [{ label: "default", key: "cohere/north-mini-code:free" }];
    let taskId;
    let expectedModel;
    for (const model of models) {
      const started = performance.now();
      const response = await fetch(origin + "/api/team-run", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          cookie,
          origin,
          "user-agent": "NewEra-Stage10-Release-Check/1.0",
        },
        body: JSON.stringify(model.id ? { task, modelId: model.id } : { task }),
        redirect: "error",
        signal: AbortSignal.timeout(70_000),
      });
      const data = await response.json().catch(() => ({}));
      const elapsedMs = Math.round(performance.now() - started);
      const steps = Array.isArray(data.steps) ? data.steps : [];
      const allRoles = steps.length === roles.length && roles.every((role, i) =>
        steps[i]?.roleId === role &&
        typeof steps[i].output === "string" &&
        steps[i].output.trim().length > 0 &&
        steps[i].output !== "[No response]" &&
        Number.isFinite(steps[i].latencyMs)
      );
      const answerCorrect = typeof data.finalAnswer === "string" &&
        /\b12\b/.test(data.finalAnswer) &&
        data.finalAnswer === steps.at(-1)?.output;
      const errorReasons = new Map([
        ["AI provider returned an empty response.", "empty-completion"],
        ["AI provider returned a non-JSON response.", "non-json"],
        ["AI provider returned a non-JSON error response.", "non-json-error"],
        ["AI provider service error. Please try again.", "upstream-5xx"],
      ]);
      taskId = safeValue(data.taskId);
      log("production-team-run", {
        selection: model.label,
        model: model.key,
        http: response.status,
        errorCode: safeValue(data.errorCode),
        errorReason: errorReasons.get(data.message) ?? null,
        elapsedMs,
        taskId,
        roles: roles.filter((role, i) => steps[i]?.roleId === role),
        roleLatencyMs: steps.map((step) => Number.isFinite(step.latencyMs) ? step.latencyMs : null),
        allRoles,
        answerCorrect,
      });
      if (response.ok && allRoles && answerCorrect && taskId) {
        expectedModel = model.key;
        break;
      }
      if (![429, 502, 503, 504].includes(response.status)) break;
    }
    assert(taskId && expectedModel, "Production Team Mode did not complete");

    const [savedTask, savedResponses] = await Promise.all([
      admin.from("tasks").select("id,mode_slug,task_text").eq("id", taskId).eq("user_id", fixtureId).single(),
      admin.from("model_responses").select("display_name,model_key,status,response_text").eq("task_id", taskId),
    ]);
    const persistedTask = !savedTask.error && savedTask.data.mode_slug === "ai-team-mode" && savedTask.data.task_text === task;
    const responses = savedResponses.data ?? [];
    const persistedRoles = !savedResponses.error && responses.length === roles.length &&
      ["Planner", "Researcher", "Critic", "Finalizer"].every((label) =>
        responses.some((row) => row.display_name === label && row.status === "success" && Boolean(row.response_text)));
    const model = responses.every((row) => row.model_key === expectedModel)
      && responses.length === roles.length ? expectedModel : null;
    log("production-team-persistence", { taskId, persistedTask, persistedRoles, model });
    assert(persistedTask && persistedRoles && model, "Team run persistence or default model check failed");
  } finally {
    if (fixtureId) {
      if (signedIn) {
        try {
          const { error } = await session.auth.signOut({ scope: "local" });
          log("fixture-sign-out", { ok: !error, code: safeValue(error?.code) });
        } catch {
          log("fixture-sign-out", { ok: false });
        }
      }
      cookiesByName.clear();
      const deleted = await admin.auth.admin.deleteUser(fixtureId);
      const after = await admin.auth.admin.getUserById(fixtureId);
      const removed = !deleted.error && !after.data?.user && (after.error?.status === 404 || after.error?.code === "user_not_found");
      log("fixture-removed", { fixtureId, removed, code: safeValue(deleted.error?.code ?? after.error?.code) });
      assert(removed, "Fixture Auth cleanup was not confirmed");
    }
  }
}

class VerificationFailure extends Error {}
try {
  await verify();
  log("complete", { ok: true });
} catch (error) {
  // Report only controlled assertion labels and error types.
  log("complete", {
    ok: false,
    type: safeValue(error?.name),
    detail: error instanceof VerificationFailure ? error.message : null,
  });
  process.exitCode = 1;
}
