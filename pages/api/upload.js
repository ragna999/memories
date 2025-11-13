// pages/api/upload.js
import formidable from "formidable";
import fs from "fs";
import path from "path";
import os from "os";
import { v4 as uuidv4 } from "uuid";
import { SogniClient } from "@sogni-ai/sogni-client";

export const config = { api: { bodyParser: false } };

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({
      keepExtensions: true,
      multiples: true,
      maxFileSize: 200 * 1024 * 1024, // server may still limit; client-side compress recommended
    });
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}

function safeMkdirSync(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* ignore */ }
}
function safeRmSync(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (e) { /* ignore */ }
}

async function initSogniClient({ username, userToken, refreshToken } = {}) {
  const appId = process.env.SOGNI_APPID || "gimlyy";
  const network = process.env.SOGNI_NETWORK || "fast";
  const client = await SogniClient.createInstance({ appId, network });

  // attach WS listeners if present (helpful for logs)
  try {
    const ws = client?.api?.ws;
    if (ws && typeof ws.on === "function") {
      ws.on("open", () => console.log("SOGNI WS: open"));
      ws.on("error", (e) => console.warn("SOGNI WS: error", e && (e.message || e)));
      ws.on("close", (c) => console.warn("SOGNI WS: close", c));
    }
  } catch (e) {
    console.warn("couldn't attach ws listeners:", e && e.message);
  }

  // try set session token if provided (best effort)
  try {
    if (username && userToken) {
      if (typeof client.account?.setToken === "function") {
        await client.account.setToken(username, { token: userToken, refreshToken });
        console.log("SOGNI: restored token session (setToken)");
      } else if (typeof client.account?.setSession === "function") {
        await client.account.setSession({ username, token: userToken, refreshToken });
        console.log("SOGNI: restored token session (setSession)");
      } else {
        console.log("SOGNI: account token set method not available on client");
      }
    }
  } catch (e) {
    console.warn("SOGNI: failed to set session token (continuing):", e && e.message);
  }

  return client;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const jobLocalId = uuidv4();
  const baseTmp = path.join(os.tmpdir(), "memories");
  safeMkdirSync(baseTmp);
  const uploadDir = path.join(baseTmp, "uploads", jobLocalId);
  safeMkdirSync(uploadDir);

  try {
    const { fields, files } = await parseForm(req).catch((err) => { throw err; });

    const prompt = (fields?.prompt || "").toString().trim();
    if (!prompt) return res.status(400).json({ error: "prompt is required" });

    // pick file
    let incoming = files.files || files.file || null;
    if (!incoming) {
      const keys = Object.keys(files || {});
      if (keys.length === 0) return res.status(400).json({ error: "No files uploaded" });
      incoming = files[keys[0]];
    }
    const fileObj = Array.isArray(incoming) ? incoming[0] : incoming;
    const tempPath = fileObj?.filepath || fileObj?.path || fileObj?.tempFilePath;
    if (!tempPath || !fs.existsSync(tempPath)) return res.status(400).json({ error: "uploaded file missing" });

    // copy to tmp dir (so we can read)
    const safeName = (fileObj.originalFilename || fileObj.newFilename || fileObj.name || "upload.bin").replace(/[^a-zA-Z0-9_.-]/g, "_");
    const dest = path.join(uploadDir, safeName);
    fs.copyFileSync(tempPath, dest);

    // read buffer
    const buffer = fs.readFileSync(dest);

    // optional cleanup temp uploaded file (formidable tmp)
    try { fs.unlinkSync(tempPath); } catch (e) {}

    // init Sogni client AND try to submit project
    const username = Array.isArray(fields.username) ? fields.username[0] : fields.username;
    const userToken = Array.isArray(fields.userToken) ? fields.userToken[0] : fields.userToken;
    const refreshToken = Array.isArray(fields.refreshToken) ? fields.refreshToken[0] : fields.refreshToken;

    let client;
    try {
      client = await initSogniClient({ username, userToken, refreshToken });
    } catch (e) {
      console.error("SOGNI init failed:", e && (e.message || e));
      // cleanup
      safeRmSync(uploadDir);
      return res.status(502).json({ error: "Failed to init Sogni client", detail: e && e.message });
    }

    // build create params - tune these to your model needs
    const params = {
      positivePrompt: prompt,
      negativePrompt: fields.negativePrompt || "lowres, watermark, bad anatomy",
      startingImage: buffer,
      startingImageStrength: Number(fields.strength || 0.55),
      guidance: Number(fields.promptStrength || 7.5),
      steps: Number(fields.steps || 28),
      numberOfImages: Number(fields.count || 1) || 1,
      outputFormat: "png",
      sizePreset: "custom",
      width: Number(fields.width || 1024),
      height: Number(fields.height || 1024),
      modelId: fields.modelId || undefined,
      tokenType: fields.tokenType || (userToken ? "sogni" : undefined),
    };

    let project;
    try {
      project = await client.projects.create(params);
      console.log("SOGNI project raw:", JSON.stringify(project));
    } catch (e) {
      console.error("SOGNI create failed:", e && (e.message || e));
      // return error but don't crash
      safeRmSync(uploadDir);
      return res.status(502).json({ error: "Sogni create failed", detail: e && (e.message || String(e)) });
    }

    // cleanup tmp dir (we don't need to persist in serverless)
    try { safeRmSync(uploadDir); } catch (e) {}

    const returnedId = project?.id || project?.projectId || project?.taskId || project?.jobId || (project && project?.meta?.id) || null;

    // return project raw for debug + jobId
    return res.status(200).json({ jobId: returnedId, projectRaw: project });
  } catch (err) {
    console.error("/api/upload error:", err && (err.message || err));
    safeRmSync(uploadDir);
    const msg = err && (err.message || String(err)) || "upload failed";
    if (/maxFileSize|maxTotalFileSize|PayloadTooLarge|exceeded/i.test(msg)) {
      return res.status(413).json({ error: "Uploaded file(s) too large", detail: msg });
    }
    return res.status(500).json({ error: msg });
  }
}
