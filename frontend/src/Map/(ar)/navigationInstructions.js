import { formatDistance } from "./routeMath";

export function formatNavigationInstruction({
  activeStep,
  maneuver,
  maneuverDistance,
  progress,
}) {
  const immediate = immediateStartInstruction(activeStep, progress);
  if (immediate) return punctuate(immediate);

  const text = cleanInstruction(maneuver?.text);
  if (!text) return "Continue.";

  const distance = Number(maneuverDistance);
  if (maneuver?.type === "arrive" && distance <= 8) {
    return punctuate(text.replace(/^arrive/i, "You have arrived"));
  }

  if (Number.isFinite(distance) && distance > 8) {
    return punctuate(`In ${formatDistance(distance)}, ${lowercaseFirst(text)}`);
  }

  return punctuate(text);
}

function immediateStartInstruction(activeStep, progress) {
  const start = activeStep?.start;
  const distanceIntoStep = Number(progress) - Number(activeStep?.startDistance || 0);
  if (!start?.text || start.type === "start" || distanceIntoStep > 10) return "";
  return cleanInstruction(start.text);
}

function cleanInstruction(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function lowercaseFirst(text) {
  return text ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

function punctuate(text) {
  if (!text) return "";
  return /[.!?]$/.test(text) ? text : `${text}.`;
}
