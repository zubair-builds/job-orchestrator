import { createServer as createHttp, type IncomingMessage, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./server.js";

const port = Number(process.env.MCP_PORT || 3333);
const mcp = createServer();
const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
await mcp.connect(transport);

const http = createHttp(async (req: IncomingMessage, res: ServerResponse) => {
  if (!req.url?.startsWith("/mcp")) {
    res.writeHead(404).end("not found");
    return;
  }
  await transport.handleRequest(req, res);
});

http.listen(port, () => {
  console.log(`MCP HTTP listening on ${port}`);
});
