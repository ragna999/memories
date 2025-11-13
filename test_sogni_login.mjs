import 'dotenv/config';
import { SogniClient } from '@sogni-ai/sogni-client';

(async () => {
  try {
    console.log('Using env:', {
      SOGNI_USERNAME: process.env.SOGNI_USERNAME ? '***SET***' : '<<NOT SET>>',
      SOGNI_APPID: process.env.SOGNI_APPID,
      SOGNI_NETWORK: process.env.SOGNI_NETWORK,
    });
    const client = await SogniClient.createInstance({
        appId: process.env.SOGNI_APPID_SERVER || (process.env.SOGNI_APPID ? `${process.env.SOGNI_APPID}-server` : 'server-app'),
        network: process.env.SOGNI_NETWORK || 'fast',
      });
      
    console.log('Instance created. Attempting login...');
    const login = await client.account.login(process.env.SOGNI_USERNAME, process.env.SOGNI_PASSWORD);
    console.log('Login result:', login ? (typeof login === 'object' ? JSON.stringify(login).slice(0,400) : String(login)) : '<<no result>>');
    await client.projects.waitForModels();
    console.log('Available models:', (client.projects.availableModels || []).length);
    console.log('First model id (if any):', client.projects.availableModels?.[0]?.id || 'none');
    process.exit(0);
  } catch (err) {
    console.error('TEST LOGIN ERROR:', err && (err.message || JSON.stringify(err)));
    process.exit(2);
  }
})();
