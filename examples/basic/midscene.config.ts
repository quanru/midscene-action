import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { defineNode, z } from '@midscene/test';
import { defineProjectSetup, defineTestProject } from '@midscene/test/config';
import { createMidsceneNodes } from '@midscene/test/midscene';
import { PlaywrightAgent } from '@midscene/web/playwright/agent';
import { chromium, type Page } from 'playwright';

const envFile = new URL('./.env', import.meta.url);
if (existsSync(envFile)) loadEnvFile(envFile);

interface Context {
  page: Page;
  agent: PlaywrightAgent;
}

const setup = defineProjectSetup<Context>({
  name: 'web',
  async setup({ onTeardown }) {
    const browser = await chromium.launch({
      headless: process.env.HEADLESS !== 'false',
    });
    onTeardown(() => browser.close());
    const page = await browser.newPage({
      viewport: { width: 1000, height: 700 },
    });
    await page.goto(new URL('./app.html', import.meta.url).href);
    const agent = new PlaywrightAgent(page);
    onTeardown(() => agent.destroy());
    return { page, agent };
  },
});

const expectGreeting = defineNode<unknown, void, Context>({
  name: 'expectGreeting',
  inputSchema: z.strictObject({}),
  description: 'Check that the greeting is Hello, Alice!.',
  async execute({ context }) {
    assert.equal(
      await context.page.locator('#greeting').textContent(),
      'Hello, Alice!',
    );
  },
});

export default defineTestProject<Context>({
  setup,
  nodes: [
    ...createMidsceneNodes<Context>({
      agentClass: PlaywrightAgent,
      getAgent: ({ context }) => context.agent,
    }),
    expectGreeting,
  ],
});
