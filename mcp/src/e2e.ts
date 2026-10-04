import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const transport = new StdioClientTransport({
  command: "npx",
  args: ["tsx", path.join(here, "stdio.ts")],
  env: {
    ...process.env,
    WEB_BASE_URL: process.env.WEB_BASE_URL || "http://localhost:3000",
    MCP_TOKEN: process.env.MCP_TOKEN || "",
  },
});

const client = new Client({ name: "job-orchestrator-e2e", version: "0.1.0" });
await client.connect(transport);

function payload(result: { content: Array<{ type: string; text?: string }> }) {
  const text = result.content.find((block) => block.type === "text")?.text || "{}";
  return JSON.parse(text);
}

const listed = payload(await client.callTool({ name: "list_actors", arguments: {} }));
const names = (listed.actors || []).map((actor: { name: string }) => actor.name);
if (!names.includes("linkedin-jobs") || names.length !== 1) {
  throw new Error(`expected only linkedin-jobs, got ${names.join(",")}`);
}

const actor = payload(await client.callTool({ name: "get_actor", arguments: { name: "linkedin-jobs" } }));
if (!actor.inputSchema?.required?.includes("search_term")) {
  throw new Error("linkedin-jobs schema missing search_term");
}

const started = payload(await client.callTool({
  name: "call_actor",
  arguments: {
    name: "linkedin-jobs",
    input: {
      search_term: "Full Stack Developer",
      location: "Berlin",
      results_wanted: 5,
      hours_old: 24,
      fixture: true,
    },
  },
}));
if (!started.runId || !started.datasetId) throw new Error(`call_actor missing ids: ${JSON.stringify(started)}`);

let run = started;
for (let i = 0; i < 20; i++) {
  run = payload(await client.callTool({ name: "get_run", arguments: { runId: started.runId } }));
  if (run.status === "SUCCEEDED" || run.status === "FAILED") break;
  await new Promise((resolve) => setTimeout(resolve, 500));
}
if (run.status !== "SUCCEEDED") throw new Error(`run did not succeed: ${JSON.stringify(run)}`);

const dataset = payload(await client.callTool({
  name: "get_dataset_items",
  arguments: { datasetId: started.datasetId, fields: "title,company,url,platform" },
}));
const item = dataset.items?.[0];
if (!item?.title || !item.company || !item.url || item.platform !== "linkedin") {
  throw new Error(`dataset item missing linkedin fields: ${JSON.stringify(dataset)}`);
}

console.log(JSON.stringify({ ok: true, runId: started.runId, datasetId: started.datasetId, item }, null, 2));
await client.close();
