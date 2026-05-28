import { readFile, writeFile } from "node:fs/promises";

const ARTISTS_PATH = new URL("../data/artists.js", import.meta.url);
const USER_AGENT = "BayAreaShowExplorer/0.1 (local non-commercial prototype)";

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.split("=");
  return [key.replace(/^--/, ""), rest.join("=") || "true"];
}));

const limit = Number(args.get("limit") || 50);
const dryRun = args.has("dry-run");
const onlyArtist = args.get("artist") || "";
const retryConsidered = args.has("retry-considered");
const saveEvery = Number(args.get("save-every") || 25);

const WIKIDATA_LINKS = {
  P2003: { type: "instagram", label: "Instagram", url: (id) => `https://www.instagram.com/${id.replace(/^@/, "")}/` },
  P2013: { type: "facebook", label: "Facebook", url: (id) => `https://www.facebook.com/${id}` },
  P2002: { type: "twitter", label: "X/Twitter", url: (id) => `https://x.com/${id.replace(/^@/, "")}` },
  P7085: { type: "tiktok", label: "TikTok", url: (id) => `https://www.tiktok.com/@${id.replace(/^@/, "")}` },
  P2397: { type: "youtube", label: "YouTube", url: (id) => `https://www.youtube.com/channel/${id}` },
  P3040: { type: "soundcloud", label: "SoundCloud", url: (id) => `https://soundcloud.com/${id}` },
  P1953: { type: "discogsArtist", label: "Discogs Artist", url: (id) => `https://www.discogs.com/artist/${id}` },
  P434: { type: "musicbrainz", label: "MusicBrainz", url: (id) => `https://musicbrainz.org/artist/${id}` },
  P1902: { type: "spotify", label: "Spotify", url: (id) => `https://open.spotify.com/artist/${id}` },
  P2722: { type: "deezer", label: "Deezer", url: (id) => `https://www.deezer.com/us/artist/${id}` },
  P4576: { type: "tidal", label: "Tidal", url: (id) => `https://tidal.com/artist/${id}` }
};

const MUSIC_OCCUPATIONS = new Set([
  "Q639669", "Q177220", "Q753110", "Q2259451", "Q488205", "Q36834",
  "Q855091", "Q753110", "Q10816969", "Q183945", "Q15981151"
]);

const MUSIC_INSTANCES = new Set([
  "Q215380", "Q2088357", "Q5741069", "Q216337", "Q10648343", "Q134556"
]);

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeName(name) {
  return name.toLowerCase().replace(/^the\s+/, "").replace(/\([^)]*\)/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function confidenceRank(confidence = "candidate") {
  return { rejected: 0, research: 1, candidate: 2, likely: 3, verified: 4 }[confidence] || 1;
}

function mergeLinks(existingLinks = [], incomingLinks = []) {
  const rejectedUrls = new Set(existingLinks
    .filter((link) => link.confidence === "rejected")
    .map((link) => normalizedUrl(link.url || "")));
  const links = new Map();
  for (const link of [...existingLinks, ...incomingLinks]) {
    if (!link?.url) continue;
    const key = normalizedUrl(link.url);
    if (rejectedUrls.has(key) && link.confidence !== "rejected") continue;
    const previous = links.get(key);
    if (!previous || confidenceRank(link.confidence) > confidenceRank(previous.confidence)) {
      links.set(key, link);
    }
  }
  return [...links.values()];
}

function normalizedUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    parsed.hostname = parsed.hostname.replace(/^www\./i, "");
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    if (/^twitter\.com$/i.test(parsed.hostname)) parsed.hostname = "x.com";
    return parsed.toString().toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

function mergeGenres(existingGenres = [], incomingTags = []) {
  const incoming = incomingTags.map((tag) => tag?.name).filter(Boolean);
  const genres = new Set(incoming.length ? (existingGenres || []).filter((genre) => genre !== "unknown") : existingGenres || []);
  for (const tag of incomingTags.slice(0, 8)) {
    if (tag?.name) genres.add(tag.name);
  }
  return [...genres];
}

function shouldUpgradeLocality(current = "", incoming = "") {
  if (!incoming) return false;
  if (!current || current === "unknown") return true;
  const currentLower = current.toLowerCase();
  const incomingLower = incoming.toLowerCase();
  return incomingLower.startsWith(`${currentLower},`) || incomingLower.includes(`${currentLower},`);
}

function addEvidence(artist, url, note) {
  artist.evidence ||= [];
  if (artist.evidence.some((item) => item.url === url && item.note === note)) return;
  artist.evidence.push({ url, note });
}

async function fetchJson(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function searchMusicBrainz(name) {
  const query = new URLSearchParams({
    query: `artist:"${name}"`,
    fmt: "json",
    limit: "5"
  });
  return fetchJson(`https://musicbrainz.org/ws/2/artist?${query}`, 10000);
}

function isGoodMusicBrainzMatch(artistName, candidate) {
  const score = Number(candidate.score || 0);
  if (score < 95) return false;
  const wanted = normalizeName(artistName);
  const candidateNames = [
    candidate.name,
    candidate["sort-name"],
    ...(candidate.aliases || []).map((alias) => alias.name)
  ].filter(Boolean).map(normalizeName);
  return candidateNames.includes(wanted);
}

function localityFromMusicBrainz(match) {
  return match["begin-area"]?.name || match.area?.name || "";
}

async function searchWikidata(name) {
  const query = new URLSearchParams({
    action: "wbsearchentities",
    search: name,
    language: "en",
    format: "json",
    limit: "5"
  });
  const result = await fetchJson(`https://www.wikidata.org/w/api.php?${query}`);
  return (result.search || []).find((item) => normalizeName(item.label || "") === normalizeName(name));
}

async function getWikidataEntity(id) {
  const query = new URLSearchParams({
    action: "wbgetentities",
    ids: id,
    props: "claims|sitelinks|descriptions|labels",
    languages: "en",
    format: "json"
  });
  const result = await fetchJson(`https://www.wikidata.org/w/api.php?${query}`);
  return result.entities?.[id];
}

function claimValues(entity, property) {
  return (entity.claims?.[property] || [])
    .map((claim) => claim.mainsnak?.datavalue?.value)
    .map((value) => {
      if (typeof value === "string") return value;
      if (value?.id) return value.id;
      return "";
    })
    .filter(Boolean);
}

function claimIds(entity, property) {
  return (entity.claims?.[property] || [])
    .map((claim) => claim.mainsnak?.datavalue?.value?.id)
    .filter(Boolean);
}

function isMusicEntity(entity) {
  const instances = new Set(claimIds(entity, "P31"));
  const occupations = new Set(claimIds(entity, "P106"));
  if ([...instances].some((id) => MUSIC_INSTANCES.has(id))) return true;
  if (instances.has("Q5") && [...occupations].some((id) => MUSIC_OCCUPATIONS.has(id))) return true;
  const description = entity.descriptions?.en?.value || "";
  return /\b(singer|musician|rapper|band|composer|dj|record producer|musical artist)\b/i.test(description);
}

function wikidataLinks(entity, id) {
  const links = [{
    type: "wikidata",
    label: "Wikidata",
    url: `https://www.wikidata.org/wiki/${id}`,
    confidence: "likely",
    source: "review-reconsider"
  }];

  for (const url of claimValues(entity, "P856")) {
    links.push({ type: "official", label: "Official", url, confidence: "likely", source: "wikidata" });
  }

  for (const [property, config] of Object.entries(WIKIDATA_LINKS)) {
    for (const value of claimValues(entity, property)) {
      links.push({
        type: config.type,
        label: config.label,
        url: config.url(value),
        confidence: "likely",
        source: "wikidata"
      });
    }
  }

  const title = entity.sitelinks?.enwiki?.title;
  if (title) {
    links.push({
      type: "wikipedia",
      label: "Wikipedia",
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}`,
      confidence: "likely",
      source: "wikidata"
    });
  }

  return links;
}

function hasRejectedWikidataId(artist, id) {
  return (artist.links || []).some((link) => {
    if (link.confidence !== "rejected") return false;
    return (link.url || "").match(/wikidata\.org\/wiki\/(Q\d+)/i)?.[1] === id;
  });
}

async function reconsiderArtist(artist, reconsideredAt) {
  const findings = [];

  try {
    const mb = await searchMusicBrainz(artist.name);
    const match = (mb.artists || []).find((candidate) => isGoodMusicBrainzMatch(artist.name, candidate));
    if (match) {
      const url = `https://musicbrainz.org/artist/${match.id}`;
      artist.links = mergeLinks(artist.links, [{
        type: "musicbrainz",
        label: "MusicBrainz",
        url,
        confidence: "likely",
        source: "musicbrainz"
      }]);
      artist.genres = mergeGenres(artist.genres, match.tags || []);
      const locality = localityFromMusicBrainz(match);
      if (shouldUpgradeLocality(artist.locality, locality)) {
        artist.locality = locality;
        addEvidence(artist, url, "Locality inferred from MusicBrainz during review reconsideration.");
      }
      artist.disambiguation ||= match.disambiguation || "";
      addEvidence(artist, url, `MusicBrainz returned a high-score artist match for "${artist.name}".`);
      findings.push("MusicBrainz");
    }
  } catch (error) {
    findings.push(`MusicBrainz skipped: ${error.message}`);
  }

  await sleep(1100);

  try {
    const search = await searchWikidata(artist.name);
    if (search?.id && !hasRejectedWikidataId(artist, search.id)) {
      const entity = await getWikidataEntity(search.id);
      if (entity && isMusicEntity(entity)) {
        const url = `https://www.wikidata.org/wiki/${search.id}`;
        artist.links = mergeLinks(artist.links, wikidataLinks(entity, search.id));
        artist.summary ||= entity.descriptions?.en?.value || "";
        addEvidence(artist, url, `Wikidata exact-name match ${search.id} passed music-artist checks during review reconsideration.`);
        findings.push("Wikidata");
      }
    }
  } catch (error) {
    findings.push(`Wikidata skipped: ${error.message}`);
  }

  await sleep(400);

  if (findings.some((finding) => finding === "MusicBrainz" || finding === "Wikidata")) {
    artist.confidence = "likely";
    artist.reconsideredAt = reconsideredAt;
    return findings.filter((finding) => finding === "MusicBrainz" || finding === "Wikidata");
  }

  artist.reconsideredAt = reconsideredAt;
  return [];
}

const store = await readWindowData(ARTISTS_PATH, "SHOW_EXPLORER_ARTISTS", { artists: {} });
const candidates = Object.values(store.artists)
  .filter((artist) => artist.confidence === "review")
  .filter((artist) => retryConsidered || !artist.reconsideredAt)
  .filter((artist) => !onlyArtist || normalizeName(artist.name) === normalizeName(onlyArtist))
  .slice(0, limit);

let promoted = 0;
const promotedArtists = [];

async function saveStore() {
  if (dryRun) return;
  store.generatedAt = new Date().toISOString();
  await writeFile(ARTISTS_PATH, `window.SHOW_EXPLORER_ARTISTS = ${JSON.stringify(store, null, 2)};\n`, "utf8");
}

for (const [index, artist] of candidates.entries()) {
  const findings = await reconsiderArtist(artist, new Date().toISOString());
  if (findings.length) {
    promoted += 1;
    promotedArtists.push({ name: artist.name, sources: findings });
    console.log(`Likely: ${artist.name} (${findings.join(", ")})`);
  }
  if ((index + 1) % saveEvery === 0) {
    await saveStore();
    console.log(`Checked ${index + 1} of ${candidates.length}; promoted ${promoted}.`);
  }
}

await saveStore();

console.log(JSON.stringify({
  checked: candidates.length,
  promoted,
  dryRun,
  promotedArtists
}, null, 2));
