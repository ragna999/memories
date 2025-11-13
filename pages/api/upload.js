// pages/api/upload.js
import formidable from "formidable";
import fs from "fs";
import path from "path";
import os from "os";
import sharp from "sharp";

export const config = { api: { bodyParser: false } };

function parseForm(req, opts = {}) {
  return new Promise((resolve, reject) => {
    const form = formidable({
      keepExtensions: true,
      multiples: false,
      maxFileSize: opts.maxFileSize || 60 * 1024 * 1024, // 60MB default
      ...opts.formidableOptions,
    });

    form.parse(req, (err, fields, files) => {
      if (err) {
        // make error message friendly
        return reject(err);
      }
      resolve({ fields, files });
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  // quick sanity: must be multipart/form-data
  const ct = req.headers["content-type"] || req.headers["Content-Type"];
  if (!ct || !ct.includes("multipart/form-data")) {
    return res.status(400).json({
      ok: false,
      error: "Bad Request: content-type must be multipart/form-data",
      receivedContentType: ct || null,
      hint: "Use form-data enctype and include file field",
    });
  }

  try {
    const { fields, files } = await parseForm(req, { maxFileSize: 60 * 1024 * 1024 });

    // debug info for logs
    console.log("/api/upload parse success - fields:", Object.keys(fields), "files:", Object.keys(files));

    // pick up file (try some common fieldnames)
    let fileObj = null;
    if (files.file) fileObj = files.file;
    else if (files.files) fileObj = files.files;
    else {
      // fallback: first file key
      const keys = Object.keys(files || {});
      if (keys.length > 0) fileObj = files[keys[0]];
    }

    if (!fileObj) {
      console.warn("/api/upload no file found, files object:", files);
      return res.status(400).json({ ok: false, error: "Bad Request: no file uploaded", files });
    }

    // ensure filepath exists (formidable v2 uses .filepath)
    const tempPath = fileObj.filepath || fileObj.path || fileObj.tempFilePath;
    if (!tempPath || !fs.existsSync(tempPath)) {
      console.error("/api/upload missing temp file path:", tempPath);
      return res.status(400).json({ ok: false, error: "Uploaded file temp path missing or not found", tempPath });
    }

    // optional: quick resize to keep payload sane (adjust as needed)
    const buffer = fs.readFileSync(tempPath);
    let resizedBuffer = buffer;
    try {
      // only attempt sharp if image (naive check)
      const mime = fileObj.mimetype || fileObj.type || "";
      if (mime.startsWith("image/")) {
        resizedBuffer = await sharp(buffer).resize(1024, 1024, { fit: "inside" }).png().toBuffer();
      }
    } catch (e) {
      console.warn("sharp resize failed (non-fatal):", e?.message || e);
      resizedBuffer = buffer;
    }

    // IMPORTANT: clean up temp file
    try { fs.unlinkSync(tempPath); } catch (e) {}

    // At this point: call Sogni or forward buffer
    // For debug/demo we'll just return jobId placeholder
    const jobId = `dbg-${Date.now()}`;

    // If you call Sogni here, put create call and return real jobId
    // e.g. const project = await client.projects.create({ startingImage: resizedBuffer, ... })
    // and set jobId = project.id

    return res.status(200).json({
      ok: true,
      jobId,
      note: "Parsed upload OK. Replace placeholder with Sogni create call to submit job.",
      fields,
      file: {
        name: fileObj.originalFilename || fileObj.newFilename || fileObj.name || null,
        size: resizedBuffer.length,
      },
    });
  } catch (err) {
    console.error("/api/upload error:", err);
    // map some common formidable errors
    const msg = err?.message || String(err);
    if (/maxFileSize|maxSize|PayloadTooLarge|exceeded/i.test(msg)) {
      return res.status(413).json({ ok: false, error: "Payload Too Large", detail: msg });
    }
    return res.status(400).json({ ok: false, error: "Bad Request - parse failed", detail: msg });
  }
}
