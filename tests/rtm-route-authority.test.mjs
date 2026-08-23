import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const routeUrl = new URL("../app/api/rtm/route.js", import.meta.url);

async function routeSource() {
  return readFile(routeUrl, "utf8");
}

test("route imports the runtime authority loader", async () => {
  assert.match(await routeSource(), /loadRuntimePackage/);
});

test("route no longer defines an inline RTM_SYSTEM_PROMPT", async () => {
  assert.doesNotMatch(await routeSource(), /const\s+RTM_SYSTEM_PROMPT\s*=/);
});

test("route uses the authority package systemPrompt as developer content", async () => {
  const source = await routeSource();
  assert.match(source, /content:\s*runtimePackage\.systemPrompt/);
});

test("route exposes package identity in successful responses", async () => {
  assert.match(await routeSource(), /packageId:\s*runtimePackage\.manifest\.packageId/);
});

test("OpenAI invocation remains server-side Responses API with store false", async () => {
  const source = await routeSource();
  assert.match(source, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(source, /store:\s*false/);
  assert.match(source, /process\.env\.OPENAI_API_KEY/);
});

test("route fails closed on runtime authority errors", async () => {
  const source = await routeSource();
  assert.match(source, /isRuntimeAuthorityError/);
  assert.match(source, /Runtime authority package rejected/);
});
