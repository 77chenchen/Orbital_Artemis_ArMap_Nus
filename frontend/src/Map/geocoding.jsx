import Openrouteservice from 'openrouteservice-js';

// initialize the Geocode service with Openrouteservice API Key
const OrsGeocode = new Openrouteservice.Geocode({ 
  api_key: "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjRmOWQ2MGZkNzdhYjQzMmU5NjY4MWYzY2M1NzljNDBkIiwiaCI6Im11cm11cjY0In0=",
});

const PLACE_HISTORY_KEY = "atlas.placeSearchHistory.v1";
const MAX_HISTORY_ITEMS = 24;

const CAMPUS_PLACES = [
  campusPlace("Central Library", "NUS Libraries · Kent Ridge", [103.77384, 1.29664], ["clb", "library", "study", "reading room", "print", "printer"], ["study", "library"]),
  campusPlace("UTown", "University Town · Education Resource Centre", [103.77318, 1.30422], ["utown", "u town", "university town", "erc", "study", "food"], ["study", "food", "student-life"]),
  campusPlace("COM3", "School of Computing · Computing Drive", [103.77367, 1.29491], ["com 3", "computing", "soc", "school of computing", "computer science"], ["school", "computing"]),
  campusPlace("COM1", "School of Computing · Computing Drive", [103.77305, 1.29404], ["com 1", "computing", "soc", "school of computing", "computer science"], ["school", "computing"]),
  campusPlace("LT27", "Lecture Theatre 27 · Science Drive", [103.78011, 1.29676], ["lt 27", "lecture theatre", "lecture hall", "science"], ["class", "science"]),
  campusPlace("University Hall", "NUS Administration · Tan Chin Tuan Wing", [103.77694, 1.29758], ["admin", "administration", "u hall"], ["admin"]),
  campusPlace("Yusof Ishak House", "Student Life · Kent Ridge", [103.77534, 1.2984], ["yih", "food", "student", "student life", "canteen"], ["food", "student-life"]),
  campusPlace("NUS Business School", "Mochtar Riady Building · BIZ", [103.7737, 1.2939], ["biz", "business", "mochtar riady", "mrb"], ["school", "business"]),
  campusPlace("S17", "Faculty of Science · Science Drive", [103.78045, 1.29603], ["science", "lab", "s 17"], ["science", "lab"]),
  campusPlace("Kent Ridge MRT", "Circle Line · National University Hospital", [103.78457, 1.29353], ["mrt", "train", "circle line", "nuh", "transport"], ["transport"]),
];

const SINGAPORE_PLACES = [
  publicPlace("Holland Village MRT", "Circle Line · Dining near campus", [103.79636, 1.31224], ["holland v", "holland village", "food", "mrt", "dining"], ["transport", "food"]),
  publicPlace("one-north MRT", "Circle Line · LaunchPad and business park", [103.78734, 1.29998], ["one north", "one-north", "mrt", "startup", "launchpad"], ["transport", "work"]),
  publicPlace("HarbourFront MRT", "Circle Line · VivoCity and Sentosa", [103.81984, 1.26525], ["harbourfront", "vivo", "vivocity", "sentosa", "mrt"], ["transport", "shopping"]),
  publicPlace("Bugis MRT", "Downtown Core · Shopping and food", [103.8551, 1.30077], ["bugis", "bugis junction", "food", "shopping", "mrt"], ["transport", "shopping", "food"]),
  publicPlace("Orchard MRT", "Orchard Road · Shopping district", [103.83296, 1.30398], ["orchard", "ion orchard", "shopping", "mrt"], ["transport", "shopping"]),
  publicPlace("Botanic Gardens MRT", "Circle Line · Singapore Botanic Gardens", [103.81595, 1.32249], ["botanic gardens", "botanic", "garden", "mrt", "park"], ["transport", "nature"]),
  publicPlace("Changi Airport", "Airport · Jewel Changi", [103.98746, 1.36442], ["changi", "airport", "jewel", "terminal"], ["airport", "travel"]),
  publicPlace("Marina Bay Sands", "Bayfront · Marina Bay", [103.86023, 1.2834], ["mbs", "marina bay", "bayfront", "casino", "skypark"], ["landmark", "shopping"]),
];

const LOCAL_PLACES = [...CAMPUS_PLACES, ...SINGAPORE_PLACES];

export function getRecommendedPlaces(limit = 6, context = {}) {
  const history = getPlaceHistory();
  const scored = scoreRecommendedPlaces(LOCAL_PLACES, history, context);
  const recommended = mergeSuggestions(
    history.map((entry, index) => historyEntryToPlace(entry, index)),
    scored.map((item) => addRecommendationReason(item.place, item.reason)),
  );
  return diversifyRecommendations(recommended, limit);
}

export function getCampusPlaceMatches(inputString, limit = 5) {
  return searchLocalPlaces(inputString, limit);
}

export default async function getSuggestions(inputString, options = {}) {
  const opts = typeof options === "number" ? options : options.opts || 5;
  const localMatches = getCampusPlaceMatches(inputString, opts);
  if (!inputString?.trim()) {
    return getRecommendedPlaces(opts);
  }

  try {
    const response = await OrsGeocode.geocode({
      text: inputString, 
      size: opts,
      boundary_country: "SG",
    });

    const features = response.features || [];
    /*features.forEach(feature => {
      console.log("Label:", feature.properties.label);
      console.log("Coordinates:", feature.geometry.coordinates);
    }); */ //for debugging
    return mergeSuggestions(localMatches, features.map(normalizeRemoteSuggestion)).slice(0, opts);
  } catch (err) {
    console.error("Autocomplete failed:", err);
    return localMatches;
  }
}

export function recordPlaceSelection(place, rawQuery = "") {
  if (!place?.geometry?.coordinates) return;

  const key = suggestionKey(place);
  const summary = suggestionSummary(place);
  const previous = getPlaceHistory();
  const existing = previous.find((entry) => entry.key === key);
  const nextEntry = {
    key,
    label: place.properties?.label || summary.name,
    name: summary.name,
    description: summary.description,
    source: summary.source,
    coordinates: place.geometry.coordinates,
    aliases: place.properties?.aliases || [],
    tags: place.properties?.tags || inferTags(`${summary.name} ${summary.description} ${rawQuery}`),
    lastQuery: String(rawQuery || "").trim(),
    count: (existing?.count || 0) + 1,
    lastSelectedAt: Date.now(),
  };

  writePlaceHistory([
    nextEntry,
    ...previous.filter((entry) => entry.key !== key),
  ].slice(0, MAX_HISTORY_ITEMS));
}

export function getPlaceHistory(limit = MAX_HISTORY_ITEMS) {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const parsed = JSON.parse(storage.getItem(PLACE_HISTORY_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => Array.isArray(entry.coordinates) && entry.coordinates.length >= 2)
      .sort((a, b) => (b.lastSelectedAt || 0) - (a.lastSelectedAt || 0))
      .slice(0, limit);
  } catch {
    return [];
  }
}

function campusPlace(name, description, coordinates, aliases = [], tags = []) {
  return placeFeature(name, description, coordinates, aliases, tags, "NUS");
}

function publicPlace(name, description, coordinates, aliases = [], tags = []) {
  return placeFeature(name, description, coordinates, aliases, tags, "Singapore");
}

function placeFeature(name, description, coordinates, aliases = [], tags = [], source = "Map") {
  return {
    type: "Feature",
    properties: {
      id: `${source.toLowerCase()}-${slugify(name)}`,
      label: source === "NUS" ? `${name}, National University of Singapore` : `${name}, Singapore`,
      name,
      description,
      source,
      confidence: 1,
      aliases,
      tags,
    },
    geometry: {
      type: "Point",
      coordinates,
    },
  };
}

function searchLocalPlaces(inputString, limit) {
  const query = normalizeSearch(inputString);
  if (!query) return getRecommendedPlaces(limit);
  const historyMatches = getPlaceHistory().map((entry, index) => ({
    place: historyEntryToPlace(entry, index),
    score: placeMatchScore(historyEntryToPlace(entry, index), query) + 16 + Math.min(entry.count || 0, 5) * 3,
  }));

  const localMatches = LOCAL_PLACES.map((place) => ({
    place,
    score: placeMatchScore(place, query),
  }));

  return [...historyMatches, ...localMatches]
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.place)
    .filter(dedupeBySuggestionKey())
    .slice(0, limit);
}

function placeMatchScore(place, query) {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return 0;

  const fields = [
    place.properties.name,
    place.properties.description,
    place.properties.label,
    ...(place.properties.aliases || []),
    ...(place.properties.tags || []),
  ].map(normalizeSearch);

  const searchable = fields.join(" ");
  const searchableCompact = compact(searchable);
  const queryCompact = compact(query);

  if (fields.some((value) => value === query)) return 140;
  if (fields.some((value) => compact(value) === queryCompact)) return 132;
  if (fields.some((value) => value.startsWith(query))) return 116;
  if (fields.some((value) => value.includes(query))) return 94;
  if (queryCompact && searchableCompact.includes(queryCompact)) return 82;

  const tokenScore = queryTokens.reduce((score, token) => {
    if (fields.some((value) => value.split(" ").includes(token))) return score + 34;
    if (fields.some((value) => value.startsWith(token))) return score + 24;
    if (fields.some((value) => value.includes(token))) return score + 16;
    if (fields.some((value) => fuzzyIncludes(value, token))) return score + 9;
    return score;
  }, 0);

  if (tokenScore > 0) {
    const coverage = tokenScore / queryTokens.length;
    return Math.round(coverage + (queryTokens.length > 1 && searchable.includes(query) ? 18 : 0));
  }

  if (queryCompact.length >= 4 && isSubsequence(queryCompact, searchableCompact)) return 18;

  return 0;
}

function scoreRecommendedPlaces(places, history, context = {}) {
  const preferredTags = preferenceTags(history, context);
  const now = new Date();
  const hour = Number.isFinite(context.hour) ? context.hour : now.getHours();
  const timeTags = hour >= 11 && hour <= 14 ? ["food"] : hour >= 18 && hour <= 22 ? ["food", "shopping"] : ["study", "transport"];
  const recentKeys = new Set(history.slice(0, 4).map((entry) => entry.key));

  return places
    .map((place, index) => {
      const key = suggestionKey(place);
      const tags = place.properties?.tags || [];
      const source = place.properties?.source || "";
      const tagScore = tags.reduce((score, tag) => score + (preferredTags[tag] || 0) * 8, 0);
      const timeScore = tags.some((tag) => timeTags.includes(tag)) ? 18 : 0;
      const sourceScore = source === "Singapore" && history.length === 0 ? 24 : source === "Singapore" ? 8 : 0;
      const campusScore = source === "NUS" ? 10 : 0;
      const recentPenalty = recentKeys.has(key) ? -8 : 0;
      const reason = recommendationReason(place, preferredTags, timeTags, history.length);
      return {
        place,
        score: 80 - index + tagScore + timeScore + sourceScore + campusScore + recentPenalty,
        reason,
      };
    })
    .sort((a, b) => b.score - a.score);
}

function preferenceTags(history, context = {}) {
  const tags = {};
  for (const entry of history) {
    const weight = Math.min(entry.count || 1, 6);
    for (const tag of entry.tags || []) {
      tags[tag] = (tags[tag] || 0) + weight;
    }
  }
  for (const tag of context.preferredTags || []) {
    tags[tag] = (tags[tag] || 0) + 4;
  }
  return tags;
}

function recommendationReason(place, preferredTags, timeTags, historyCount) {
  const tags = place.properties?.tags || [];
  const matchedPreference = tags.find((tag) => preferredTags[tag]);
  if (matchedPreference) return `Based on your ${readableTag(matchedPreference)} searches`;
  const matchedTime = tags.find((tag) => timeTags.includes(tag));
  if (matchedTime) return `${readableTag(matchedTime)} pick for now`;
  if (place.properties?.source === "Singapore" && historyCount === 0) return "Singapore pick beyond campus";
  return place.properties?.source === "NUS" ? "Useful on campus" : "Popular Singapore place";
}

function addRecommendationReason(place, reason) {
  return {
    ...place,
    properties: {
      ...place.properties,
      recommendationReason: reason,
    },
  };
}

function diversifyRecommendations(places, limit) {
  const selected = places.slice(0, limit);
  if (limit < 4 || selected.some((place) => place.properties?.source === "Singapore")) {
    return selected;
  }

  const singaporePick = places.find((place) => place.properties?.source === "Singapore");
  if (singaporePick && selected.length > 0) {
    selected[selected.length - 1] = singaporePick;
  }
  return selected;
}

function historyEntryToPlace(entry, index = 0) {
  return {
    type: "Feature",
    properties: {
      id: entry.key || `history-${index}`,
      label: entry.label || entry.name,
      name: entry.name || entry.label || "Recent place",
      description: entry.description || "Recent search",
      source: "History",
      aliases: entry.aliases || [],
      tags: entry.tags || [],
      recommendationReason: entry.count > 1 ? `Visited ${entry.count} times` : "Recently selected",
    },
    geometry: {
      type: "Point",
      coordinates: entry.coordinates,
    },
  };
}

function normalizeRemoteSuggestion(place) {
  const properties = place.properties || {};
  const label = properties.label || properties.name || "";
  const tags = inferTags(label);
  return {
    ...place,
    properties: {
      ...properties,
      source: properties.source || properties.layer || "Map",
      tags,
      aliases: properties.aliases || [],
    },
  };
}

function mergeSuggestions(primary, secondary) {
  const seen = new Set();
  const result = [];

  for (const place of [...primary, ...secondary]) {
    const key = suggestionKey(place);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(place);
  }

  return result;
}

function dedupeBySuggestionKey() {
  const seen = new Set();
  return (place) => {
    const key = suggestionKey(place);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  };
}

function suggestionKey(place) {
  const label = place?.properties?.label || place?.properties?.name || "";
  const coords = place?.geometry?.coordinates || [];
  return `${label.toLowerCase()}-${coords.map((value) => Number(value).toFixed(5)).join(",")}`;
}

function suggestionSummary(place) {
  const properties = place?.properties || {};
  const label = properties.label || properties.name || "Unknown place";
  const parts = label.split(",").map((part) => part.trim()).filter(Boolean);
  return {
    name: properties.name || parts[0] || label,
    description: properties.description || parts.slice(1, 3).join(" · ") || "Singapore",
    source: properties.source || properties.layer || "Map",
  };
}

function writePlaceHistory(history) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(PLACE_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Ignore storage quota/private mode failures; search should keep working.
  }
}

function getStorage() {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

function inferTags(text) {
  const value = normalizeSearch(text);
  const tagRules = [
    ["food", ["food", "dining", "canteen", "restaurant", "hawker", "cafe"]],
    ["study", ["study", "library", "reading", "seminar"]],
    ["transport", ["mrt", "bus", "train", "station", "airport", "terminal"]],
    ["shopping", ["mall", "shopping", "orchard", "vivo", "bugis"]],
    ["science", ["science", "lab"]],
    ["computing", ["computing", "computer", "soc", "com"]],
    ["business", ["business", "biz"]],
    ["nature", ["garden", "park", "botanic"]],
  ];
  return tagRules
    .filter(([, words]) => words.some((word) => value.includes(word)))
    .map(([tag]) => tag);
}

function readableTag(tag) {
  return String(tag || "").replace(/-/g, " ");
}

function normalizeSearch(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokenize(value) {
  return normalizeSearch(value).split(" ").filter(Boolean);
}

function compact(value) {
  return normalizeSearch(value).replace(/\s+/g, "");
}

function fuzzyIncludes(field, token) {
  if (token.length < 4) return false;
  return field.split(" ").some((word) => levenshtein(word, token) <= (token.length <= 5 ? 1 : 2));
}

function isSubsequence(needle, haystack) {
  let cursor = 0;
  for (const char of haystack) {
    if (char === needle[cursor]) cursor += 1;
    if (cursor === needle.length) return true;
  }
  return false;
}

function levenshtein(a, b) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let before = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        before + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      before = temp;
    }
  }
  return previous[b.length];
}

function slugify(value) {
  return normalizeSearch(value).replace(/\s+/g, "-");
}
