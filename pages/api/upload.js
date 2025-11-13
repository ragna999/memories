// pages/api/upload.js
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export const config = { api: { bodyParser: false } };

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({
      keepExtensions: true,
      multiples: true,
      maxFileSize: 1000* 1024 * 1024,
    });

    form.parse(req, (err, fields, files) => {
      if (err) {
        return reject(err);
      }
      resolve({ fields, files });
    });
  });
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
    const strength = parseFloat(fields.strength || fields.startingImageStrength || '0.55');
    const imageSize = fields.imageSize ? String(fields.imageSize) : "1024x1024";
    const promptStrength = parseFloat(fields.promptStrength || fields.guidance || '7.5');
    const modelId = fields.modelId ? String(fields.modelId) : undefined;
    const tokenTypeRaw = (fields.tokenType || fields.token || '').toString().toLowerCase() || undefined;
    const tokenType = ['auto', 'spark', 'sogni'].includes(tokenTypeRaw) ? tokenTypeRaw : undefined;

    if (!prompt) return res.status(400).json({ error: 'prompt is required' });

    const jobId = uuidv4();
    const uploadDir = path.join(process.cwd(), 'uploads', jobId);
    fs.mkdirSync(uploadDir, { recursive: true });

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

    let usernameRaw = fields.username;
if (Array.isArray(usernameRaw)) usernameRaw = usernameRaw[0];
const username = usernameRaw ? String(usernameRaw).trim() : null;

let refreshTokenRaw = fields.refreshToken;
if (Array.isArray(refreshTokenRaw)) refreshTokenRaw = refreshTokenRaw[0];
const refreshToken = refreshTokenRaw ? String(refreshTokenRaw).trim() : null;

const userTokenRaw = Array.isArray(fields.userToken)
  ? fields.userToken[0]
  : fields.userToken;
const userToken = userTokenRaw ? String(userTokenRaw).trim() : null;

const job = {
  jobId,
  prompt,
  strength,
  promptStrength,
  modelId,
  tokenType: tokenType || undefined,
  files: savedPaths,
  username,
  userToken,
  refreshToken,
  imageSize,
  createdAt: Date.now(),
  status: "queued",
};


    const jobsDir = path.join(process.cwd(), 'jobs');
    fs.mkdirSync(jobsDir, { recursive: true });
    fs.writeFileSync(path.join(jobsDir, `${jobId}.json`), JSON.stringify(job, null, 2), 'utf8');

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
