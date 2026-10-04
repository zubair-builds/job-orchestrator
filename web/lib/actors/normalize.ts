import { createHash } from "crypto";

export function normalizeToken(value: string) {
  return value
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(inc|llc|ltd|gmbh|ag|se|corp|co)\b/gi, " ")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase();
}

export function jobHash(company: string, title: string, location: string) {
  return createHash("sha256")
    .update(`${normalizeToken(company)}|${normalizeToken(title)}|${normalizeToken(location)}`)
    .digest("hex");
}

export type Listing = {
  title: string;
  company: string;
  location: string | null;
  url: string;
  platform: string;
  description: string | null;
  isRemote: boolean;
  datePosted: string | null;
};

export function listingFromJobSpy(row: Record<string, unknown>, fallbackPlatform: string): Listing | null {
  const title = stringOrEmpty(row.title);
  const company = stringOrEmpty(row.company);
  const url = stringOrEmpty(row.job_url) || stringOrEmpty(row.job_url_direct);
  if (!title || !company || !url) return null;
  const platform = stringOrEmpty(row.site) || fallbackPlatform;
  return {
    title,
    company,
    location: stringOrEmpty(row.location) || null,
    url,
    platform,
    description: stringOrEmpty(row.description) || null,
    isRemote: Boolean(row.is_remote),
    datePosted: stringOrEmpty(row.date_posted) || null,
  };
}

function stringOrEmpty(value: unknown) {
  if (value == null) return "";
  return String(value).trim();
}
