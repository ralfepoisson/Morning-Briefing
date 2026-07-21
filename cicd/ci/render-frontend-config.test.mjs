import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const rendererPath = path.resolve(import.meta.dirname, 'render-frontend-config.mjs');

test('renders deterministic JavaScript without allowing configuration values to inject code', function () {
  const outputDirectory = mkdtempSync(path.join(tmpdir(), 'morning-briefing-config-'));
  const firstOutput = path.join(outputDirectory, 'first.js');
  const secondOutput = path.join(outputDirectory, 'second.js');
  const environment = {
    ...process.env,
    FRONTEND_API_BASE_URL: "/api/v1?label=Ralfe's briefing",
    FRONTEND_AUTH_SERVICE_SIGN_IN_URL: 'https://auth.example.test/signIn?next="dashboard"',
    FRONTEND_AUTH_SERVICE_APPLICATION_ID: 'application-id',
    FRONTEND_AUTH_SERVICE_SIGN_OUT_URL: 'https://auth.example.test/logout',
    FRONTEND_APP_BASE_URL: 'https://briefing.example.test/'
  };

  execFileSync(process.execPath, [rendererPath, firstOutput], { env: environment });
  execFileSync(process.execPath, [rendererPath, secondOutput], { env: environment });

  const firstContents = readFileSync(firstOutput, 'utf8');
  const secondContents = readFileSync(secondOutput, 'utf8');
  const context = {
    window: {}
  };

  assert.equal(firstContents, secondContents);
  vm.runInNewContext(firstContents, context);
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.window.__MORNING_BRIEFING_CONFIG__)),
    {
      apiBaseUrl: environment.FRONTEND_API_BASE_URL,
      authServiceSignInUrl: environment.FRONTEND_AUTH_SERVICE_SIGN_IN_URL,
      authServiceApplicationId: environment.FRONTEND_AUTH_SERVICE_APPLICATION_ID,
      authServiceSignOutUrl: environment.FRONTEND_AUTH_SERVICE_SIGN_OUT_URL,
      appBaseUrl: environment.FRONTEND_APP_BASE_URL
    }
  );
});

test('uses the production-safe defaults when optional environment values are absent', function () {
  const outputDirectory = mkdtempSync(path.join(tmpdir(), 'morning-briefing-default-config-'));
  const outputPath = path.join(outputDirectory, 'config.js');
  const environment = { ...process.env };

  Object.keys(environment).forEach(function removeFrontendSetting(key) {
    if (key.startsWith('FRONTEND_')) {
      delete environment[key];
    }
  });

  execFileSync(process.execPath, [rendererPath, outputPath], { env: environment });

  const context = {
    window: {}
  };
  vm.runInNewContext(readFileSync(outputPath, 'utf8'), context);

  assert.deepEqual(
    JSON.parse(JSON.stringify(context.window.__MORNING_BRIEFING_CONFIG__)),
    {
      apiBaseUrl: '/api/v1',
      authServiceSignInUrl: 'https://auth.life-sqrd.com/signIn',
      authServiceApplicationId: '39863fc2-c2b9-4b5f-82ee-04841b2e9980',
      authServiceSignOutUrl: '',
      appBaseUrl: ''
    }
  );
});
