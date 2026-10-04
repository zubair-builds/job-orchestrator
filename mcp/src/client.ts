const base = process.env.WEB_BASE_URL || "http://localhost:3000";
const token = process.env.MCP_TOKEN || "";

export type ActorSummary = { name: string; title: string; description: string };

function headers() {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function read(res: Response) {
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(body.error || `${res.status} ${text.slice(0, 200)}`);
  }
  return body;
}

export async function listActors(): Promise<ActorSummary[]> {
  const body = await read(await fetch(`${base}/api/actors`, { headers: headers() }));
  return body.actors;
}

export async function getActor(name: string) {
  return read(await fetch(`${base}/api/actors/${encodeURIComponent(name)}`, { headers: headers() }));
}

export async function callActor(name: string, input: Record<string, unknown>) {
  return read(await fetch(`${base}/api/actors/${encodeURIComponent(name)}/runs`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(input),
  }));
}

export async function getRun(runId: string) {
  return read(await fetch(`${base}/api/runs/${encodeURIComponent(runId)}`, { headers: headers() }));
}

export async function getDatasetItems(datasetId: string, limit = 20, offset = 0, fields?: string) {
  const url = new URL(`${base}/api/datasets/${encodeURIComponent(datasetId)}/items`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  if (fields) url.searchParams.set("fields", fields);
  return read(await fetch(url, { headers: headers() }));
}
