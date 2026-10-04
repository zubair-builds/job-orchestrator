export type ActorDef = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export const actors: ActorDef[] = [
  {
    name: "linkedin-jobs",
    title: "LinkedIn jobs",
    description:
      "Search LinkedIn only. location is the place filter. There is no country field. call_actor returns runId and datasetId, not the rows.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["search_term", "location"],
      properties: {
        search_term: { type: "string", minLength: 1 },
        location: { type: "string", minLength: 1, description: "LinkedIn location text, e.g. Berlin or Germany." },
        results_wanted: { type: "integer", minimum: 1, maximum: 50, default: 10 },
        hours_old: { type: "integer", minimum: 1, maximum: 720, default: 24 },
        is_remote: { type: "boolean", default: false },
        linkedin_fetch_description: { type: "boolean", default: false },
        fixture: {
          type: "boolean",
          default: false,
          description: "Test only. Honored when the scraper has ALLOW_FIXTURE=1. Do not use in production.",
        },
      },
    },
  },
];

export function getActor(name: string) {
  return actors.find((actor) => actor.name === name) || null;
}
