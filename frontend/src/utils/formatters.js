export function formatPlayerName(name) {
  if (!name) return "";
  // Title-case each word while preserving spacing and numbers
  return name
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
