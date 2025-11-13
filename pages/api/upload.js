// pages/api/upload.js  (PATCHED quick-fix)
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

export const config = { api: { bodyParser: false } };

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({
      keepExtensions: true,
      multiples: true,
      maxFileSize: 1000 * 1024 * 1024,
    });

    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}

function safeMkdirSync(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    // ignore - we'll handle missing dir later
    console.warn('safeMkdirSync failed:', e && e.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    let parsed;
    try {
      parsed = await parseForm(req);
    } catch (err) {
      console.error('/api/upload parseForm error', err);
      const msg = err && (err.message || String(err)) || 'upload parse error';
      if (/maxTotalFileSize|maxFileSize|PayloadTooLarge|exceeded/i.test(msg)) {
        return res.status(413).json({ error: 'Uploaded file(s) too large', detail: msg });
      }
      return res.status(400).json({ error: msg });
    }

    const { fields, files } = parsed;
    const prompt = (fields.prompt || '').toString().trim();
    if (!prompt) return res.status(400).json({ error: 'prompt is required' });

    const jobId = uuidv4();

    // === CHANGE: use platform tmp dir, not process.cwd() (Vercel's /var/task is readonly) ===
    const baseTmp = path.join(os.tmpdir(), 'memories'); // /tmp/memories on most systems
    safeMkdirSync(baseTmp);
    const uploadDir = path.join(baseTmp, 'uploads', jobId);
    safeMkdirSync(uploadDir);

    // normalize incoming files
    let incoming = files.files || files.file || null;
    if (!incoming) {
      const keys = Object.keys(files || {});
      if (keys.length === 0) return res.status(400).json({ error: 'No files uploaded' });
      incoming = files[keys[0]];
    }
    const arr = Array.isArray(incoming) ? incoming : [incoming];
    const savedPaths = [];

    for (let i = 0; i < arr.length; i++) {
      const f = arr[i];
      const tempPath = f?.filepath || f?.path || f?.tempFilePath;
      const origName = f?.originalFilename || f?.name || `file_${i}`;
      if (!tempPath || !fs.existsSync(tempPath)) {
        throw new Error(`Uploaded temp file missing for ${origName}`);
      }
      const safeName = origName.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const dest = path.join(uploadDir, safeName);
      fs.copyFileSync(tempPath, dest);
      try { fs.unlinkSync(tempPath); } catch (e) {}
      savedPaths.push(dest);
    }

    const usernameRaw = Array.isArray(fields.username) ? fields.username[0] : fields.username;
    const username = usernameRaw ? String(usernameRaw).trim() : null;

    const userTokenRaw = Array.isArray(fields.userToken) ? fields.userToken[0] : fields.userToken;
    const userToken = userTokenRaw ? String(userTokenRaw).trim() : null;

    const job = {
      jobId,
      prompt,
      files: savedPaths,
      username,
      userToken,
      createdAt: Date.now(),
      status: 'queued',
    };

    // === CHANGE: store job metadata in tmp (quick fix). NOTE: /tmp is ephemeral on serverless
    const jobsDir = path.join(baseTmp, 'jobs');
    safeMkdirSync(jobsDir);
    const jobFile = path.join(jobsDir, `${jobId}.json`);
    fs.writeFileSync(jobFile, JSON.stringify(job, null, 2), 'utf8');

    // return jobId immediately — worker (recommended) will pick it up.
    return res.status(200).json({ jobId });
  } catch (err) {
    console.error('/api/upload error', err);
    const msg = err && (err.message || String(err)) || 'upload failed';
    if (/maxTotalFileSize|maxFileSize|PayloadTooLarge|exceeded/i.test(msg)) {
      return res.status(413).json({ error: 'Uploaded file(s) too large', detail: msg });
    }
    return res.status(500).json({ error: msg });
  }
}
