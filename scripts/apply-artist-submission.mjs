import { readFile, writeFile } from "node:fs/promises";

const ARTISTS_PATH = new URL("../data/artists.js", import.meta.url);
const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.split("=");
  return [key.replace(/^--/, ""), rest.join("=") || "true"];
}));

const file = args.get("file");
if (!file) {
  throw new Error("Usage: node scripts/apply-artist-submission.mjs --file=docs/submissions/example.json");
}

async function readWindowData(path, globalName, fallback) {
  try {
    const text = await readFile(path, "utf8");
    const match = text.match(new RegExp(`window\\.${globalName}\\s*=\\s*([\\s\\S]*);\\s*$`));
    return match ? JSON.parse(match[1]) : fallback;
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function mergeLinks(existingLinks = [], incomingLinks = []) {
  const links = new Map();
  for (const link of [...existingLinks, ...incomingLinks]) {
    if (!link?.url) continue;
    links.set(link.url, link);
  }
  return [...links.values()];
}

const store = await readWindowData(ARTISTS_PATH, "SHOW_EXPLORER_ARTISTS", { artists: {} });
const submission = JSON.parse(await readFile(new URL(`../${file}`, import.meta.url), "utf8"));
const id = submission.id || slugify(submission.name);
const existing = store.artists[id] || {
  id,
  name: submission.name,
  aliases: [],
  source: {
    firstSeenAt: new Date().toISOString(),
    lastImportedAt: "",
    appearances: []
  }
};

store.artists[id] = {
  ...existing,
  ...submission,
  id,
  links: mergeLinks(existing.links || [], submission.links || []),
  evidence: [...(existing.evidence || []), ...(submission.evidence || [])]
};

store.generatedAt = new Date().toISOString();
await writeFile(ARTISTS_PATH, `window.SHOW_EXPLORER_ARTISTS = ${JSON.stringify(store, null, 2)};\n`, "utf8");
console.log(`Applied submission for ${store.artists[id].name}`);
