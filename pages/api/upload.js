// pages/api/upload.js
import formidable from "formidable";
import fs from "fs";
import path from "path";
import os from "os";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import { SogniClient } from "@sogni-ai/sogni-client";

export const config = { api: { bodyParser: false } };

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({
      keepExtensions: true,
      multiples: false,
      maxFileSize: 60 * 1024 * 1024,
    });
    form.parse(req, (err, fields, files) => (err ? reject(err) : resolve({ fields, files })));
  });
}

async function createClientAndAuth({ username, userToken, refreshToken }) {
  const appId = process.env.SOGNI_APPID || "gimlyy";
  const network = process.env.SOGNI_NETWORK || "fast";
  const client = await SogniClient.createInstance({ appId, network });

  // try restoring user session if token provided (worker used client.account.setToken style)
  try {
    if (username && (userToken || refreshToken)) {
      if (typeof client.account?.setToken === "function") {
        await client.account.setToken(username, { token: userToken, refreshToken });
        client.account.session = { token: userToken, refreshToken };
      } else if (typeof client.account?.setSession === "function") {
        // fallback naming
        await client.account.setSession({ username, token: userToken, refreshToken });
      }
    }
  } catch (e) {
    console.warn("Failed to set session token (non-fatal):", e?.message || e);
  }

  // don't force connect here; some SDKs will open ws lazily on project.create
  return client;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { fields, files } = await parseForm(req);
    const prompt = (fields.prompt || "").toString();
    if (!prompt) return res.status(400).json({ error: "prompt required" });

    // optional user creds for Sogni session
    const username = fields.username ? String(fields.username) : null;
    const userToken = fields.userToken ? String(fields.userToken) : null;
    const refreshToken = fields.refreshToken ? String(fields.refreshToken) : null;

    // pick file
    const fileObj = (files?.file && !Array.isArray(files.file)) ? files.file : Object.values(files || {})[0];
    if (!fileObj) return res.status(400).json({ error: "file is required" });

    // read buffer and resize (to reasonable size)
    const tmpPath = fileObj.filepath || fileObj.path || fileObj.tempFilePath;
    if (!tmpPath || !fs.existsSync(tmpPath)) return res.status(400).json({ error: "uploaded file missing" });

    const buff = fs.readFileSync(tmpPath);
    // resize via sharp to 768-1024 square-ish (adjust to your model needs)
    const resized = await sharp(buff).resize(1024, 1024, { fit: "cover" }).png().toBuffer();

    // create Sogni client and auth (if provided)
    let client;
    try {
      client = await createClientAndAuth({ username, userToken, refreshToken });
    } catch (e) {
      console.error("Sogni client init failed:", e?.message || e);
      return res.status(502).json({ error: "Failed to init Sogni client", detail: e?.message || String(e) });
    }

    // build params (mirror what worker used)
    const params = {
      modelId: fields.modelId || undefined,
      positivePrompt: prompt,
      negativePrompt: fields.negativePrompt || "lowres, watermark, bad anatomy",
      startingImage: resized,
      startingImageStrength: Number(fields.strength ?? 0.55),
      guidance: Number(fields.promptStrength ?? 7.5),
      steps: Number(fields.steps ?? 20),
      numberOfImages: Number(fields.count ?? 1) || 1,
      outputFormat: "png",
      sizePreset: "custom",
      width: Number(fields.width || 1024),
      height: Number(fields.height || 1024),
      tokenType: fields.tokenType || (userToken ? "sogni" : undefined),
    };

    // create project/job on Sogni
    let project;
    try {
      project = await client.projects.create(params);
    } catch (e) {
      console.error("Sogni projects.create failed:", e?.message || e);
      return res.status(502).json({ error: "Sogni create failed", detail: e?.message || String(e) });
    } finally {
      // cleanup uploaded tmp file
      try { fs.unlinkSync(tmpPath); } catch {}
    }

    // try to resolve an id to return
    const jobId = project?.id || project?.projectId || project?.taskId || project?.jobId || (project && project?.meta?.id) || uuidv4();

    // return jobId to frontend — frontend will poll /api/status?jobId=<jobId>
    return res.status(200).json({ jobId, created: true });
  } catch (err) {
    console.error("/api/upload error:", err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
