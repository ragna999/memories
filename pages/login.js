// pages/api/login.js
import { SogniClient } from "@sogni-ai/sogni-client";
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { username, password } = req.body || {};

  if (!username || !password)
    return res.status(400).json({ error: "username and password required" });

  try {
    // 🧹 Hapus cache .sogni sebelum login biar refresh token lama gak kepakai
    const sogniCache = path.join(process.env.HOME || process.env.USERPROFILE, ".sogni");
    if (fs.existsSync(sogniCache)) {
      fs.rmSync(sogniCache, { recursive: true, force: true });
      console.log("🧹 Old Sogni cache removed before login");
    }

    // 🧩 Buat client instance baru
    const client = await SogniClient.createInstance({
      appId: process.env.SOGNI_APPID || "gimlyy",
      network: process.env.SOGNI_NETWORK || "fast",
    });

    // 🔑 Login pakai username & password
    const loginRes = await client.account.login(username, password);

    if (!loginRes || !loginRes.token) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const token = loginRes.token || loginRes.accessToken;
    const refreshToken = loginRes.refreshToken || loginRes.refresh_token || null;

    if (typeof client.account.saveSession === "function") {
      await client.account.saveSession(username);
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
