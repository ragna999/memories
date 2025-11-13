// pages/api/status.js
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

export default async function handler(req, res) {
  const jobId = req.query.jobId || req.body?.jobId;
  if (!jobId) return res.status(400).json({ error: "jobId required" });

  let client;
  try {
    client = await makeClient();
  } catch (e) {
    console.error("Sogni init failed (status):", e);
    return res.status(502).json({ error: "Failed to init Sogni client", detail: e?.message || String(e) });
  }

  try {
    let info = null;

    // try common project/task getters
    const tries = [
      async () => client.projects?.get && await client.projects.get(jobId),
      async () => client.projects?.describe && await client.projects.describe(jobId),
      async () => client.tasks?.get && await client.tasks.get(jobId),
      async () => client.tasks?.status && await client.tasks.status(jobId),
    ];

    for (const fn of tries) {
      try {
        const r = await fn();
        if (r) { info = r; break; }
      } catch (err) {
        if (isNotFoundError(err)) {
          // treat as not found for this attempt; continue tries in case another method works
          continue;
        } else {
          // other errors: log and continue trying other method variants
          console.warn("status method attempt error (non-not-found):", err && err.message);
          continue;
        }
      }
    }

    if (!info) {
      // not found at Sogni for now: return 202 Pending so UI keeps polling (don't throw 502)
      return res.status(202).json({ status: "pending", message: "Job not found yet at Sogni — please retry polling", jobId });
    }

    // Normalize common fields
    const normalized = {
      status: info.status || info.state || info.jobStatus || info.phase || "unknown",
      outputs: info.outputs || info.results || info.images || null,
      raw: info,
    };

    return res.status(200).json(normalized);
  } catch (e) {
    console.error("Error fetching status from Sogni (final):", e);
    return res.status(502).json({ error: "Failed to fetch status from Sogni", detail: e?.message || String(e) });
  }
}
