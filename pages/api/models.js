// pages/api/models.js
import 'dotenv/config';
import { SogniClient } from '@sogni-ai/sogni-client';

export default async function handler(req, res) {
  if (req.method !== 'GET')
    return res.status(405).json({ error: 'Method not allowed' });

  try {
    const client = await SogniClient.createInstance({
      appId: process.env.SOGNI_APPID || 'models-list',
      network: process.env.SOGNI_NETWORK || 'fast',
    });

    await client.account.login(process.env.SOGNI_USERNAME, process.env.SOGNI_PASSWORD);
    console.log("✅ Logged in to Sogni network:", process.env.SOGNI_NETWORK);

    // 🧩 tunggu SDK sync model list dari server
    try {
      await client.projects.waitForModels();
    } catch (e) {
      console.warn('⚠️ waitForModels warning:', e);
    }

    // 🔍 ambil model list langsung dari projects
    const models = (client.projects.availableModels || []).map((m) => ({
      id: m.id,
      name: m.name || m.id,
      workerCount: m.workerCount || 0,
    }));

    console.log('🧠 Models fetched:', models.length);
    return res.status(200).json({ models });
  } catch (err) {
    console.error('❌ /api/models error:', err);
    return res.status(500).json({ error: err.message });
  }
}
