import 'dotenv/config';
import { SogniClient } from '@sogni-ai/sogni-client';

(async()=>{
  const c = await SogniClient.createInstance({ appId: process.env.SOGNI_APPID || 'test', network: process.env.SOGNI_NETWORK || 'main' });
  await c.account.login(process.env.SOGNI_USERNAME, process.env.SOGNI_PASSWORD);
  await c.projects.waitForModels();
  const modelId = 'coreml-sogni_artist_v1_768';
  console.log('Trying modelId', modelId);
  try {
    const p = await c.projects.create({ modelId, positivePrompt: 'test', steps:1, guidance:1, numberOfImages:1, outputFormat:'png', tokenType: process.env.SOGNI_TOKEN_TYPE || 'sogni' });
    console.log('Created project, id:', p.id || '(no id visible)');
  } catch(e) {
    console.error('create error', e);
  }
  process.exit(0);
})();
