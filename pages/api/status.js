// pages/api/status.js
import { SogniClient } from "@sogni-ai/sogni-client";

async function makeClient() {
  const appId = process.env.SOGNI_APPID || "gimlyy";
  const network = process.env.SOGNI_NETWORK || "fast";
  const client = await SogniClient.createInstance({ appId, network });
  return client;
}

export default async function handler(req, res) {
  const jobId = req.query.jobId || req.body?.jobId;
  if (!jobId) return res.status(400).json({ error: "jobId required" });

  let client;
  try {
    client = await makeClient();
  } catch (e) {
    console.error("Sogni client init error (status):", e?.message || e);
    return res.status(502).json({ error: "Failed to init Sogni client", detail: e?.message || String(e) });
  }

  try {
    // Try common SDK methods to fetch project/task info.
    let info = null;

    if (typeof client.projects?.get === "function") {
      info = await client.projects.get(jobId);
    } else if (typeof client.projects?.describe === "function") {
      info = await client.projects.describe(jobId);
    } else if (typeof client.tasks?.get === "function") {
      info = await client.tasks.get(jobId);
    } else if (typeof client.tasks?.status === "function") {
      info = await client.tasks.status(jobId);
    } else {
      // Fallback: maybe SDK allows constructing a project handle
      try {
        const p = await client.projects.createHandle?.(jobId) || null;
        if (p && typeof p.status === "function") info = await p.status();
      } catch (e) {
        // ignore fallback errors
      }
    }

    // If info is still null, error out
    if (!info) {
      return res.status(404).json({ error: "job not found in Sogni (SDK method missing or job id invalid)" });
    }

    // Normalize response: try common fields
    const normalized = {
      status: info.status || info.state || info?.jobStatus || info?.phase || "unknown",
      outputs: info.outputs || info.results || info?.images || info?.outputs || null,
      raw: info,
    };

    return res.status(200).json(normalized);
  } catch (e) {
    console.error("Error fetching status from Sogni:", e?.message || e);
    // If websocket or connection issues happen, return 502 with detail, not 500
    return res.status(502).json({ error: "Failed to fetch status from Sogni", detail: e?.message || String(e) });
  }
}
