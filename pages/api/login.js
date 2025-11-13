// pages/api/login.js
import { SogniClient } from "@sogni-ai/sogni-client";
import fs from "fs";
import path from "path";
import os from "os";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { username, password } = req.body || {};

  if (!username || !password)
    return res.status(400).json({ error: "username and password required" });

  try {
    // safe path resolution: prefer HOME/USERPROFILE if present, else os.homedir(), else tmpdir
    const homeEnv = process.env.HOME || process.env.USERPROFILE;
    const baseDir = typeof homeEnv === "string" && homeEnv.length > 0
      ? homeEnv
      : (os.homedir() || os.tmpdir() || process.cwd());

    const sogniCache = path.join(baseDir, ".sogni");

    // debug log (optional) - remove or lower verbosity in prod if noisy
    console.log("Sogni cache path:", sogniCache);

    // guard filesystem ops: check type & existence before rm
    try {
      if (typeof sogniCache === "string" && fs.existsSync(sogniCache)) {
        fs.rmSync(sogniCache, { recursive: true, force: true });
        console.log("🧹 Old Sogni cache removed before login");
      }
    } catch (fsErr) {
      console.warn("Could not remove sogni cache (continuing):", fsErr && fsErr.message);
      // continue — not fatal for login
    }

    const client = await SogniClient.createInstance({
      appId: process.env.SOGNI_APPID || "gimlyy",
      network: process.env.SOGNI_NETWORK || "fast",
    });

    const loginRes = await client.account.login(username, password);

    if (!loginRes || !loginRes.token) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const token = loginRes.token || loginRes.accessToken;
    const refreshToken = loginRes.refreshToken || loginRes.refresh_token || null;

    if (typeof client.account.saveSession === "function") {
      try {
        await client.account.saveSession(username);
      } catch (saveErr) {
        console.warn("saveSession failed (non-fatal):", saveErr && saveErr.message);
      }
    }

    console.log(`✅ User ${username} logged in successfully`);

    return res.status(200).json({
      success: true,
      username,
      token,
      refreshToken,
    });
  } catch (e) {
    console.error("❌ Sogni login error:", e);
    return res.status(500).json({ error: e.message || "Sogni login failed" });
  }
}
