import { readFile, writeFile } from "node:fs/promises";

const EVENTS_PATH = new URL("../data/imported-events.js", import.meta.url);
const VENUES_PATH = new URL("../data/venues.js", import.meta.url);
const ARTISTS_PATH = new URL("../data/artists.js", import.meta.url);

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.split("=");
  return [key.replace(/^--/, ""), rest.join("=") || "true"];
}));

const dryRun = args.has("dry-run");

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

function venueIdFor(event) {
  const anchor = (event.venueHref || "").match(/club\.html#([^/?#]+)/i)?.[1];
  return event.venueId || (anchor ? slugify(anchor) : slugify(event.venue || "unknown-venue"));
}

function resolvedVenue(venues, id) {
  const venue = venues[id];
  if (venue?.mergedInto && venues[venue.mergedInto]) return venues[venue.mergedInto];
  return venue;
}

function isRejectedVenue(venues, id) {
  const venue = resolvedVenue(venues, id);
  return venue?.confidence === "rejected";
}

const events = await readWindowData(EVENTS_PATH, "SHOW_EXPLORER_EVENTS", []);
const venueStore = await readWindowData(VENUES_PATH, "SHOW_EXPLORER_VENUES", { venues: {} });
const artistStore = await readWindowData(ARTISTS_PATH, "SHOW_EXPLORER_ARTISTS", { artists: {} });

const eventVenueIds = new Map(events.map((event) => [event.id, venueIdFor(event)]));
const removed = [];

for (const [id, artist] of Object.entries(artistStore.artists || {})) {
  if (artist.confidence === "verified") continue;
  const appearances = artist.source?.appearances || [];
  if (!appearances.length) continue;

  const venueIds = appearances
    .map((appearance) => eventVenueIds.get(appearance.eventId))
    .filter(Boolean);

  if (!venueIds.length) continue;
  if (venueIds.every((venueId) => isRejectedVenue(venueStore.venues || {}, venueId))) {
    removed.push({ id, name: artist.name, appearances: venueIds.length });
    if (!dryRun) delete artistStore.artists[id];
  }
}

if (!dryRun) {
  artistStore.generatedAt = new Date().toISOString();
  await writeFile(ARTISTS_PATH, `window.SHOW_EXPLORER_ARTISTS = ${JSON.stringify(artistStore, null, 2)};\n`, "utf8");
}

console.log(JSON.stringify({ removed: removed.length, dryRun, artists: removed }, null, 2));
