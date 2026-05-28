const events = [...(window.SHOW_EXPLORER_EVENTS || [])].sort((a, b) => {
  return a.date.localeCompare(b.date) || a.venue.localeCompare(b.venue);
});
const artistStore = window.SHOW_EXPLORER_ARTISTS?.artists || {};
const venueStore = window.SHOW_EXPLORER_VENUES?.venues || {};

const state = {
  query: "",
  filter: "all"
};

const eventList = document.querySelector("#eventList");
const eventTemplate = document.querySelector("#eventTemplate");
const artistTemplate = document.querySelector("#artistTemplate");
const searchInput = document.querySelector("#searchInput");
const filterButtons = [...document.querySelectorAll("[data-filter]")];

const confidenceLabels = {
  verified: "verified",
  likely: "likely",
  review: "review"
};

function formatDate(dateText) {
  const date = new Date(`${dateText}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(date);
}

function textForEvent(event) {
  return [
    event.date,
    event.venue,
    enrichVenue(event).city,
    enrichVenue(event).region,
    event.details,
    ...event.artists.map(enrichArtist).flatMap((artist) => [
      artist.name,
      artist.locality,
      ...(artist.genres || artist.tags || [])
    ])
  ].join(" ").toLowerCase();
}

function matchesFilter(event) {
  if (state.filter === "all") return true;
  if (state.filter === "tonight") return event.date === new Date().toISOString().slice(0, 10);
  if (state.filter === "allAges") return /\ba\/a\b|all ages/i.test(event.details);
  if (state.filter === "local") return event.artists.map(enrichArtist).some((artist) => /bay area|local|california/i.test(artist.locality));
  if (state.filter === "needsReview") return event.artists.map(enrichArtist).some((artist) => artist.confidence === "review");
  return true;
}

function visibleEvents() {
  const query = state.query.trim().toLowerCase();
  return events.filter((event) => {
    const queryMatch = !query || textForEvent(event).includes(query);
    return queryMatch && matchesFilter(event);
  });
}

function updateSummary(list) {
  const artists = list.flatMap((event) => event.artists.map(enrichArtist));
  document.querySelector("#eventCount").textContent = list.length;
  document.querySelector("#artistCount").textContent = artists.length;
  document.querySelector("#reviewCount").textContent = artists.filter((artist) => artist.confidence === "review").length;
}

function enrichArtist(artist) {
  const enrichment = artistStore[slugify(artist.name)] || {};
  return {
    ...artist,
    ...enrichment,
    links: enrichment.links || artist.links || []
  };
}

function enrichVenue(event) {
  const venue = venueStore[event.venueId || venueIdFor(event)];
  if (venue?.mergedInto && venueStore[venue.mergedInto]) return venueStore[venue.mergedInto];
  return venue || {
    name: event.venue,
    displayName: event.venue,
    city: event.city || "",
    region: ""
  };
}

function renderArtist(artist) {
  const displayArtist = enrichArtist(artist);
  const node = artistTemplate.content.firstElementChild.cloneNode(true);
  node.querySelector(".artist-name").textContent = displayArtist.name;
  node.querySelector(".artist-tags").textContent = (displayArtist.genres || displayArtist.tags || []).join(" / ");
  node.querySelector(".artist-note").textContent = displayArtist.summary || displayArtist.reviewNotes || displayArtist.note || "";

  const confidence = node.querySelector(".confidence");
  confidence.textContent = confidenceLabels[displayArtist.confidence] || "unknown";
  confidence.classList.add(displayArtist.confidence || "review");

  const links = node.querySelector(".artist-links");
  prioritizedLinks(displayArtist).forEach((link) => {
    const anchor = document.createElement("a");
    anchor.href = link.url;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    anchor.textContent = link.label;
    links.append(anchor);
  });

  return node;
}

function prioritizedLinks(artist) {
  const priority = supportPriorityForLinks(artist.links || []);
  return [...(artist.links || [])].filter((link) => link.confidence !== "rejected").sort((a, b) => {
    const aRank = priority.includes(a.type) ? priority.indexOf(a.type) : priority.length;
    const bRank = priority.includes(b.type) ? priority.indexOf(b.type) : priority.length;
    return aRank - bRank || labelForType(a.type).localeCompare(labelForType(b.type)) || confidenceRank(b.confidence) - confidenceRank(a.confidence);
  });
}

function supportPriorityForLinks(links) {
  const verifiedTypes = [...new Set(links
    .filter((link) => link.confidence === "verified")
    .map((link) => link.type)
    .filter(Boolean))];
  return verifiedTypes.sort((a, b) => {
    return priorityBucket(a) - priorityBucket(b) || labelForType(a).localeCompare(labelForType(b));
  });
}

function priorityBucket(type) {
  if (type === "official") return 0;
  if (type === "linktree") return 1;
  return 2;
}

function labelForType(type = "") {
  const labels = {
    appleMusic: "Apple Music",
    amazonMusic: "Amazon Music",
    bandcamp: "Bandcamp",
    deezer: "Deezer",
    discogs: "Discogs",
    discogsAlias: "Discogs Alias",
    discogsArtist: "Discogs Artist",
    discogsLegalName: "Discogs Legal Name",
    facebook: "Facebook",
    instagram: "Instagram",
    linktree: "Linktree",
    musicbrainz: "MusicBrainz",
    official: "Official",
    qobuz: "Qobuz",
    search: "Search",
    soundcloud: "SoundCloud",
    spotify: "Spotify",
    tidal: "Tidal",
    tiktok: "TikTok",
    twitter: "X/Twitter",
    wikidata: "Wikidata",
    wikipedia: "Wikipedia",
    youtube: "YouTube",
    youtubeMusic: "YouTube Music"
  };
  return labels[type] || type || "Link";
}

function confidenceRank(confidence = "candidate") {
  return { rejected: 0, research: 1, candidate: 2, likely: 3, verified: 4 }[confidence] || 1;
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
  return anchor ? slugify(anchor) : slugify(event.venue || "unknown-venue");
}

function render() {
  const list = visibleEvents();
  updateSummary(list);
  eventList.replaceChildren();

  if (list.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No shows match these filters yet.";
    eventList.append(empty);
    return;
  }

  list.forEach((event) => {
    const venue = enrichVenue(event);
    const node = eventTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".event-date").dateTime = event.date;
    node.querySelector(".event-date").textContent = formatDate(event.date);
    const venuePlace = [venue.city, venue.region].filter(Boolean).join(", ");
    const venueName = venue.displayName || venue.name || event.venue;
    node.querySelector(".event-venue").textContent = venuePlace ? `${venueName}, ${venuePlace}` : venueName;
    node.querySelector(".event-detail").textContent = event.details;

    const artistList = node.querySelector(".artist-list");
    event.artists.forEach((artist) => artistList.append(renderArtist(artist)));
    eventList.append(node);
  });
}

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  render();
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filterButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.filter = button.dataset.filter;
    render();
  });
});

render();
