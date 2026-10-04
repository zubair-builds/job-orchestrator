import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { callActor, getActor, getDatasetItems, getRun, listActors } from "./client.js";

export function createServer() {
  const server = new McpServer({ name: "job-orchestrator", version: "0.1.0" });

  server.registerTool("list_actors", {
    description: "List runnable job actors. MVP exposes linkedin-jobs only.",
    inputSchema: {},
  }, async () => text({ actors: await listActors() }));

  server.registerTool("get_actor", {
    description: "Get one actor, including its input JSON schema.",
    inputSchema: { name: z.string() },
  }, async ({ name }) => text(await getActor(name)));

  server.registerTool("call_actor", {
    description: "Start an actor run. Returns runId and datasetId, not the listings. Read items with get_dataset_items.",
    inputSchema: {
      name: z.string(),
      input: z.record(z.unknown()),
    },
  }, async ({ name, input }) => text(await callActor(name, input)));

  server.registerTool("get_run", {
    description: "Get actor run status. Poll until SUCCEEDED or FAILED.",
    inputSchema: { runId: z.string() },
  }, async ({ runId }) => text(await getRun(runId)));

  server.registerTool("get_dataset_items", {
    description: "Read dataset items for a finished run. Supports limit, offset, and a comma-separated fields filter.",
    inputSchema: {
      datasetId: z.string(),
      limit: z.number().int().min(1).max(100).optional(),
      offset: z.number().int().min(0).optional(),
      fields: z.string().optional(),
    },
  }, async ({ datasetId, limit, offset, fields }) => text(await getDatasetItems(datasetId, limit ?? 20, offset ?? 0, fields)));

  return server;
}

function text(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}
