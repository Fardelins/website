import { Agent } from 'node:https';

const logisticsAgent = new Agent({
  keepAlive: false,
  maxSockets: 8,
});

export default {
  '/contact-form-config': {
    target: 'https://cms.fardelins.com',
    secure: true,
    changeOrigin: true,
    pathRewrite: { '^/contact-form-config': '/contact/' },
    logLevel: 'warn',
  },
  '/wp-json': {
    target: 'https://cms.fardelins.com',
    secure: true,
    changeOrigin: true,
    logLevel: 'warn',
  },
  '/v1': {
    target: 'https://staging.fardelins.com',
    secure: true,
    changeOrigin: true,
    agent: logisticsAgent,
    headers: { Connection: 'close' },
    proxyTimeout: 120_000,
    timeout: 120_000,
    logLevel: 'warn',
  },
  '/wp-admin': {
    target: 'https://cms.fardelins.com',
    secure: true,
    changeOrigin: true,
    headers: { Cookie: 'hc_js_gate=1' },
    logLevel: 'warn',
  },
};
