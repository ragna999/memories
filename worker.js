// worker.js — auto-detect Spark/Sogni, flexible token system
import "dotenv/config";
import fs from "fs";
import path from "path";
import PQueue from "p-queue";
import { SogniClient } from "@sogni-ai/sogni-client";
import sharp from "sharp";

const JOBS_DIR = path.join(process.cwd(), "jobs");
const UPLOADS_DIR = path.join(process.cwd(), "uploads");

const JOB_SCAN_INTERVAL_MS = Number(process.env.JOB_SCAN_INTERVAL_MS) || 2000;
const JOB_CONCURRENCY = Number(process.env.JOB_CONCURRENCY) || 1;
const FILE_CONCURRENCY = Number(process.env.FILE_CONCURRENCY) || 1;
const POST_SUCCESS_DELAY_MS = Number(process.env.POST_SUCCESS_DELAY_MS) || 600;
const MAX_RETRIES = Number(process.env.MAX_RETRIES) || 5;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ensureDirs() {
  [JOBS_DIR, UPLOADS_DIR].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
}

function safeParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

/** ========== Sogni Client Factory ========== */
async function createSogniClient(job) {
  const token = job?.userToken;
  const refreshToken = job?.refreshToken;
  const username = job?.username;

  // deteksi token Spark (heuristik berdasarkan payload)
  const isSparkToken =
    job?.tokenType === "spark" ||
    token?.toLowerCase().includes("spark") ||
    job?.username?.toLowerCase().includes("spark");

  const network = isSparkToken ? "spark" : "fast";
  const appId = process.env.SOGNI_APPID_WORKER || "gimly-app";

  console.log(`🔧 Creating SogniClient [${network}]...`);
  const client = await SogniClient.createInstance({ appId, network });

  if (username && token) {
    await client.account.setToken(username, { token, refreshToken });
    client.account.session = { token, refreshToken };
    console.log(`✅ Session restored for ${username} (${isSparkToken ? "Spark" : "Sogni"})`);
  } else {
    console.error("❌ Missing userToken/username in job JSON");
    return null;
  }

  if (typeof client.connect === "function") {
    await client.connect().catch(() => {});
  }

  return { client, isSparkToken };
}

/** ========== Retry Helper ========== */
async function createProjectWithRetry(client, params) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await client.projects.create(params);
    } catch (err) {
      const msg = err?.message || String(err);
      if (!/429|Too Many Requests|RateLimit/i.test(msg)) throw err;
      const backoff = Math.min(15000, 500 * 2 ** attempt);
      console.log(`⏳ Rate limited (attempt ${attempt}), retry in ${backoff}ms`);
      await sleep(backoff);
    }
  }
  throw new Error("Failed to create project after max retries");
}

/** ========== Job Processor ========== */
async function processJob(_, job, jobFilePath) {
  const { client, isSparkToken } = (await createSogniClient(job)) || {};
  if (!client) return;

  try {
    const fileQueue = new PQueue({ concurrency: FILE_CONCURRENCY });
    const mappings = [];

    await Promise.all(
      (job.files || []).map((fpath) =>
        fileQueue.add(async () => {
          const fname = path.parse(fpath).name;
          console.log(`[${job.jobId}] 🎨 Processing ${fname}...`);

          if (!fs.existsSync(fpath)) {
            console.warn(`[${job.jobId}] ⚠️ Missing input: ${fpath}`);
            mappings.push({ input: fpath, error: "input missing" });
            return;
          }

          let [width, height] = [1024, 1024];
          if (typeof job.imageSize === "string") {
            const [w, h] = job.imageSize.toLowerCase().split("x").map(Number);
            if (!isNaN(w) && !isNaN(h)) [width, height] = [w, h];
          }

          const tmpResized = await sharp(fpath)
            .resize(width, height, { fit: "cover" })
            .png({ compressionLevel: 9 })
            .toBuffer();

          await client.projects.waitForModels().catch(() => {});
          const available = client.projects.availableModels || [];

          // ===== Model & tokenType auto selection =====
          const tokenType = isSparkToken ? "spark" : "sogni";
          let selectedModel =
            job.modelId ||
            (isSparkToken ? "flux1-schnell-fp8" : "coreml-sogni_artist_v1_768");

          if (!available.find((m) => m.id === selectedModel)) {
            console.warn(`⚠️ Model ${selectedModel} not found → fallback`);
            selectedModel = isSparkToken
              ? "coreml-sogniXLturbo_alpha1_ad"
              : "coreml-sogni_artist_v1_768";
          }

          console.log(`[${job.jobId}] Using model=${selectedModel}, tokenType=${tokenType}`);

          try {
            const params = {
              modelId: selectedModel,
              positivePrompt: job.prompt,
              negativePrompt: job.negativePrompt || "lowres, watermark, bad anatomy",
              startingImage: tmpResized,
              startingImageStrength: job.strength ?? 0.55,
              guidance: job.promptStrength ?? 7.5,
              steps: job.steps ?? 20,
              numberOfImages: 1,
              outputFormat: "png",
              sizePreset: "custom",
              width,
              height,
              tokenType,
            };

            const project = await createProjectWithRetry(client, params);
            const result = await project.waitForCompletion();

            const resultUrl =
              typeof result === "string"
                ? result
                : Array.isArray(result) && typeof result[0] === "string"
                ? result[0]
                : result?.url || result?.outputs?.[0]?.url;

            if (!resultUrl) throw new Error("No output URL from Sogni SDK");

            mappings.push({ input: fpath, url: resultUrl, error: "" });
            console.log(`[${job.jobId}] ✅ Done: ${resultUrl}`);
          } catch (err) {
            mappings.push({ input: fpath, error: err.message });
            console.error(`[${job.jobId}] ❌ Error:`, err.message);
          }

          await sleep(POST_SUCCESS_DELAY_MS);
        })
      )
    );

    job.status = mappings.some((m) => !m.error) ? "done" : "error";
    job.completedAt = Date.now();
    job.outputs = mappings;
    fs.writeFileSync(jobFilePath, JSON.stringify(job, null, 2));
  } catch (err) {
    job.status = "error";
    job.error = err.message;
    fs.writeFileSync(jobFilePath, JSON.stringify(job, null, 2));
  }
}

/** ========== Cleanup ========== */
async function cleanupOldFiles() {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000;
  let deletedJobs = 0,
    deletedUploads = 0;

  try {
    const jobFiles = fs.readdirSync(JOBS_DIR).filter((f) => f.endsWith(".json"));
    for (const jf of jobFiles) {
      const jobPath = path.join(JOBS_DIR, jf);
      const stat = fs.statSync(jobPath);
      if (now - stat.mtimeMs > maxAge) {
        fs.unlinkSync(jobPath);
        deletedJobs++;
      }
    }
  } catch (e) {
    console.warn("⚠️ Cleanup jobs error:", e.message);
  }

  try {
    const uploadDirs = fs.readdirSync(UPLOADS_DIR);
    for (const dir of uploadDirs) {
      const fullPath = path.join(UPLOADS_DIR, dir);
      if (!fs.lstatSync(fullPath).isDirectory()) continue;
      const stat = fs.statSync(fullPath);
      if (now - stat.mtimeMs > maxAge) {
        fs.rmSync(fullPath, { recursive: true, force: true });
        deletedUploads++;
      }
    }
  } catch (e) {
    console.warn("⚠️ Cleanup uploads error:", e.message);
  }

  if (deletedJobs || deletedUploads)
    console.log(`🧹 Cleanup → ${deletedJobs} jobs, ${deletedUploads} uploads deleted`);
}

/** ========== Main Loop ========== */
(async () => {
  await ensureDirs();
  const jobQueue = new PQueue({ concurrency: JOB_CONCURRENCY });
  console.log("🚀 Worker started (auto Spark/Sogni mode). Watching:", JOBS_DIR);

  while (true) {
    try {
      const jobFiles = fs.readdirSync(JOBS_DIR).filter((f) => f.endsWith(".json"));
      for (const jf of jobFiles) {
        const jobPath = path.join(JOBS_DIR, jf);
        const job = safeParseJSON(fs.readFileSync(jobPath, "utf8"));
        if (!job || job.status !== "queued") continue;

        job.status = "running";
        job.startedAt = Date.now();
        fs.writeFileSync(jobPath, JSON.stringify(job, null, 2));
        jobQueue.add(() => processJob(null, job, jobPath));
      }

      const now = Date.now();
      if (!global.lastCleanupAt || now - global.lastCleanupAt > 10 * 60 * 1000) {
        await cleanupOldFiles();
        global.lastCleanupAt = now;
      }
    } catch (err) {
      console.error("Worker loop error:", err.message);
    }
    await sleep(JOB_SCAN_INTERVAL_MS);
  }
})();
