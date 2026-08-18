#!/usr/bin/env node
/**
 * P2P Browser Automation Agent
 * ----------------------------
 * The cloud engine handles reading/monitoring (Binance API), SMS matching and
 * Telegram alerts. This agent performs the two actions Binance does not expose
 * over the public API:
 *
 *   1. send_bank_details -> posts your payment details into the P2P order chat
 *   2. release_usdt      -> clicks "Release" (confirm) on a paid order
 *
 * Run it on any always-on machine or cheap VPS. It only needs outbound HTTPS.
 *
 * Setup:
 *   npm init -y && npm i playwright && npx playwright install chromium
 *   AGENT_TOKEN=xxxxx APP_URL=https://your-app.lovable.app node p2p-agent.mjs
 *
 * First run opens a browser window (HEADLESS=false) so you can log in to
 * Binance once; the session is saved to ./binance-session so later runs are
 * headless.
 */

import { chromium } from "playwright";
import { existsSync, mkdirSync } from "node:fs";

const APP_URL = (process.env.APP_URL ?? "").replace(/\/$/, "");
const AGENT_TOKEN = process.env.AGENT_TOKEN ?? "";
const HEADLESS = process.env.HEADLESS !== "false";
const POLL_MS = Number(process.env.POLL_MS ?? 10000);
const PROFILE_DIR = process.env.PROFILE_DIR ?? "./binance-session";
const VERSION = "1.0.0";

if (!APP_URL || !AGENT_TOKEN) {
  console.error("Set APP_URL and AGENT_TOKEN environment variables.");
  process.exit(1);
}
if (!existsSync(PROFILE_DIR)) mkdirSync(PROFILE_DIR, { recursive: true });

const api = async (payload) => {
  const res = await fetch(`${APP_URL}/api/public/agent/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${AGENT_TOKEN}` },
    body: JSON.stringify({ ...payload, version: VERSION }),
  });
  if (!res.ok) throw new Error(`${payload.action} failed: ${res.status} ${await res.text()}`);
  return res.json();
};

const orderUrl = (orderId) => `https://p2p.binance.com/en/fiatOrderDetail?orderNo=${orderId}`;

async function sendBankDetails(page, task) {
  await page.goto(orderUrl(task.order_id), { waitUntil: "domcontentloaded" });
  const box = page.locator('textarea, div[contenteditable="true"]').first();
  await box.waitFor({ timeout: 30000 });
  await box.click();
  for (const line of String(task.payload.message ?? "").split("\n")) {
    await page.keyboard.type(line);
    await page.keyboard.press("Shift+Enter");
  }
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1500);
  return "Payment details posted into the order chat.";
}

async function releaseUsdt(page, task) {
  await page.goto(orderUrl(task.order_id), { waitUntil: "domcontentloaded" });
  const release = page
    .getByRole("button", { name: /release|confirm release|payment received/i })
    .first();
  await release.waitFor({ timeout: 30000 });
  await release.click();
  const confirm = page.getByRole("button", { name: /^(confirm|yes|release)$/i }).first();
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await page.waitForTimeout(2500);
  return "Release action confirmed in the Binance UI.";
}

const context = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: HEADLESS,
  viewport: { width: 1366, height: 900 },
});
const page = context.pages()[0] ?? (await context.newPage());
await page.goto("https://p2p.binance.com/en/trade", { waitUntil: "domcontentloaded" }).catch(() => {});
console.log(`Agent ${VERSION} online. Polling ${APP_URL} every ${POLL_MS}ms.`);

for (;;) {
  try {
    const { tasks = [], paused } = await api({ action: "claim" });
    if (paused) console.log("Engine master switch is OFF — idling.");
    for (const task of tasks) {
      console.log(`> ${task.task_type} for order ${task.order_id}`);
      try {
        const result =
          task.task_type === "send_bank_details"
            ? await sendBankDetails(page, task)
            : await releaseUsdt(page, task);
        await api({ action: "complete", task_id: task.id, ok: true, result });
        console.log(`  done: ${result}`);
      } catch (error) {
        const message = String(error?.message ?? error).slice(0, 900);
        await api({ action: "complete", task_id: task.id, ok: false, result: message });
        console.error(`  failed: ${message}`);
      }
    }
  } catch (error) {
    console.error("poll error:", String(error?.message ?? error));
  }
  await new Promise((r) => setTimeout(r, POLL_MS));
}
