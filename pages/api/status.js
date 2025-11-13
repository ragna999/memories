// pages/api/status.js (debug-friendly)
// paste & deploy this exact file
import { SogniClient } from "@sogni-ai/sogni-client";

async function makeClient() {
  const client = await SogniClient.createInstance({
    appId: process.env.SOGNI_APPID || "gimlyy",
    network: process.env.SOGNI_NETWORK || "fast",
  });
  return client;
}

function isNotFoundError(err) {
  const msg = (err && (err.message || "")).toString().toLowerCase();
  return msg.includes("not found") || msg.includes("404") || msg.includes("project not found") || msg.includes("task not found");
}

function safeTrim(obj, max = 2000) {
  try {
    const s = typeof obj === "string" ? obj : JSON.stringify(obj);
    return s.length > max ? s.slice(0, max) + "...(truncated)" : s;
  } catch (e) {
    return String(obj).slice(0, max);
  }
}

export default async function handler(req, res) {
  const jobId = req.query.jobId || req.body?.jobId;
  const wantDebug = String(req.query.debug || "").toLowerCase() === "1" || String(req.query.debug || "").toLowerCase() === "true";

  if (!jobId) return res.status(400).json({ error: "jobId required" });

  let client;
  try {
    client = await makeClient();
  } catch (e) {
    const msg = e?.message || String(e);
    console.error("Sogni init failed (status):", msg);
    return res.status(502).json({ error: "Failed to init Sogni client", detail: wantDebug ? safeTrim(msg) : undefined });
  }

  // Try a few getters and collect debug traces
  const attempts = [];
  try {
    const tryFns = [
      { name: "projects.get", fn: async () => client.projects?.get && await client.projects.get(jobId) },
      { name: "projects.describe", fn: async () => client.projects?.describe && await client.projects.describe(jobId) },
      { name: "tasks.get", fn: async () => client.tasks?.get && await client.tasks.get(jobId) },
      { name: "tasks.status", fn: async () => client.tasks?.status && await client.tasks.status(jobId) },
    ];

    let info = null;
    for (const t of tryFns) {
      try {
        if (typeof t.fn !== "function") {
          attempts.push({ name: t.name, ok: false, reason: "method-not-available" });
          continue;
        }
        const r = await t.fn();
        attempts.push({ name: t.name, ok: true, got: safeTrim(r) });
        if (r) { info = r; break; }
      } catch (err) {
        const errMsg = err?.message || String(err);
        attempts.push({ name: t.name, ok: false, error: safeTrim(errMsg) });
        if (!isNotFoundError(err)) {
          // log non-not-found errors for debugging
          console.warn(`status attempt ${t.name} error:`, errMsg);
        }
      }
    }

    if (!info) {
      // not found; return 202 so UI keeps polling
      const payload = { status: "pending", jobId, attempts };
      // if debug asked, also include note how to debug on server side
      if (wantDebug) return res.status(202).json({ ...payload, debugNote: "job not found yet; attempts logged", rawDebug: attempts });
      return res.status(202).json(payload);
    }

    // normalize
    const normalized = {
      status: info.status || info.state || info.jobStatus || info.phase || "unknown",
      outputs: info.outputs || info.results || info.images || null,
      raw: info,
      attempts,
    };

    return res.status(200).json(normalized);
  } catch (e) {
    console.error("status final error:", e?.message || e);
    if (wantDebug) return res.status(502).json({ error: "Failed to fetch status from Sogni", detail: safeTrim(e?.message || String(e)), attempts });
    return res.status(502).json({ error: "Failed to fetch status from Sogni" });
  }
}
