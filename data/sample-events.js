window.SHOW_EXPLORER_EVENTS = [
  {
    id: "2026-05-27-gilman-worst-party-ever",
    date: "2026-05-27",
    venue: "Gilman",
    city: "Berkeley",
    details: "all ages, $18/$20, 6pm/6:30pm",
    sourceUrl: "https://jon.luini.com/thelist/date.html",
    artists: [
      {
        name: "Worst Party Ever",
        tags: ["emo", "indie rock"],
        locality: "touring",
        confidence: "likely",
        note: "Likely match from streaming and music metadata sources. Needs final check against the bill.",
        links: [
          { label: "Spotify", url: "https://open.spotify.com/search/Worst%20Party%20Ever" },
          { label: "Bandcamp", url: "https://bandcamp.com/search?q=Worst%20Party%20Ever" }
        ]
      },
      {
        name: "Camp Ghost",
        tags: ["unknown"],
        locality: "unknown",
        confidence: "review",
        note: "No confident match yet. This is exactly where community submissions will matter.",
        links: [
          { label: "Search", url: "https://duckduckgo.com/?q=%22Camp%20Ghost%22%20band" }
        ]
      },
      {
        name: "Robo Pumpkin",
        tags: ["unknown"],
        locality: "unknown",
        confidence: "review",
        note: "Candidate links should be reviewed before display as verified artist info.",
        links: [
          { label: "Search", url: "https://duckduckgo.com/?q=%22Robo%20Pumpkin%22%20band" }
        ]
      }
    ]
  },
  {
    id: "2026-05-29-bottom-chip-kinman",
    date: "2026-05-29",
    venue: "Bottom of the Hill",
    city: "San Francisco",
    details: "21+, $20, 8pm/8:30pm",
    sourceUrl: "https://jon.luini.com/thelist/date.html",
    artists: [
      {
        name: "Chip Kinman & Band",
        tags: ["punk", "roots rock"],
        locality: "California",
        confidence: "likely",
        note: "Older and side-project-heavy artists need disambiguation, but this is a plausible match.",
        links: [
          { label: "Spotify", url: "https://open.spotify.com/search/Chip%20Kinman" },
          { label: "MusicBrainz", url: "https://musicbrainz.org/search?query=Chip%20Kinman&type=artist&method=indexed" }
        ]
      },
      {
        name: "Steakhouse",
        tags: ["unknown"],
        locality: "unknown",
        confidence: "review",
        note: "Common-name collision risk. Keep unverified until a source confirms the exact act.",
        links: [
          { label: "Search", url: "https://duckduckgo.com/?q=%22Steakhouse%22%20band%20San%20Francisco" }
        ]
      },
      {
        name: "Temple Beautiful Band",
        tags: ["local"],
        locality: "Bay Area",
        confidence: "review",
        note: "Looks locally contextual, but still needs an official link or venue confirmation.",
        links: [
          { label: "Search", url: "https://duckduckgo.com/?q=%22Temple%20Beautiful%20Band%22" }
        ]
      }
    ]
  },
  {
    id: "2026-05-30-stork-darts",
    date: "2026-05-30",
    venue: "thee Stork Club",
    city: "Oakland",
    details: "21+, $15/$17, 8pm",
    sourceUrl: "https://jon.luini.com/thelist/date.html",
    artists: [
      {
        name: "The Darts",
        tags: ["garage rock", "punk"],
        locality: "touring",
        confidence: "verified",
        note: "Higher-confidence example card with direct fan-support links.",
        links: [
          { label: "Bandcamp", url: "https://thedartsus.bandcamp.com/" },
          { label: "Spotify", url: "https://open.spotify.com/search/The%20Darts" },
          { label: "Instagram", url: "https://www.instagram.com/thedartsus/" }
        ]
      },
      {
        name: "Service",
        tags: ["unknown"],
        locality: "unknown",
        confidence: "review",
        note: "Short names produce noisy matches. A human approval queue should handle this.",
        links: [
          { label: "Search", url: "https://duckduckgo.com/?q=%22Service%22%20band%20%22The%20Darts%22" }
        ]
      },
      {
        name: "Pretty Frankenstein",
        tags: ["punk"],
        locality: "unknown",
        confidence: "review",
        note: "Potentially discoverable through venue flyers and social search.",
        links: [
          { label: "Search", url: "https://duckduckgo.com/?q=%22Pretty%20Frankenstein%22%20band" }
        ]
      }
    ]
  }
];
