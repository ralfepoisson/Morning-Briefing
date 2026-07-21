import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ciDirectory = import.meta.dirname;

test('frontend image uses pinned Node 24 and nginx images and checks its health endpoint', function () {
  const dockerfile = readFileSync(path.join(ciDirectory, 'Dockerfile.frontend'), 'utf8');

  assert.match(dockerfile, /^FROM node:24-bookworm-slim@sha256:[a-f0-9]{64} AS build$/m);
  assert.match(dockerfile, /^FROM nginx:1\.29-alpine@sha256:[a-f0-9]{64} AS runtime$/m);
  assert.doesNotMatch(dockerfile, /^ARG [A-Z0-9_]*(SECRET|TOKEN|KEY|AUTH)[A-Z0-9_]*=/mi);
  assert.match(dockerfile, /^USER nginx$/m);
  assert.match(dockerfile, /^ENTRYPOINT \["nginx"\]$/m);
  assert.match(dockerfile, /^HEALTHCHECK [\s\S]*?\/healthz/m);

  const mainConfig = readFileSync(path.join(ciDirectory, 'nginx-main.conf'), 'utf8');
  assert.doesNotMatch(mainConfig, /^user\s/m);
  assert.match(mainConfig, /^pid \/tmp\/nginx\.pid;$/m);
  assert.match(mainConfig, /^\s*client_body_temp_path \/tmp\/nginx-client-body;$/m);
  assert.match(mainConfig, /^\s*proxy_temp_path \/tmp\/nginx-proxy;$/m);
});

test('nginx exposes health, protects responses, and never serves SPA HTML for API routes', function () {
  const nginxConfig = readFileSync(path.join(ciDirectory, 'nginx.conf'), 'utf8');

  assert.match(nginxConfig, /location = \/healthz\s*\{[^}]*return 200/m);
  assert.match(nginxConfig, /add_header X-Content-Type-Options "nosniff" always;/);
  assert.match(nginxConfig, /add_header X-Frame-Options "DENY" always;/);
  assert.match(nginxConfig, /location \^~ \/api\/\s*\{[^}]*return 404/m);
  assert.match(nginxConfig, /location = \/config\.js\s*\{[^}]*Cache-Control/m);
});
