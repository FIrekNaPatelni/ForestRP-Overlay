const RELEASES_URL = 'https://github.com/FIrekNaPatelni/ForestRP-Overlay/releases/latest';
const API_URL = 'https://api.github.com/repos/FIrekNaPatelni/ForestRP-Overlay/releases/latest';
function parseVersion(value) {
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\+[\w.-]+)?$/.exec(value);
  return match ? match.slice(1, 4).map(Number) : null;
}
function newerVersion(candidate, current) {
  const a = parseVersion(candidate), b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}
async function checkRelease(current, fetcher = fetch) {
  const response = await fetcher(API_URL, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'ForestRP-Overlay' }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(response.status === 404 ? 'Brak publicznego wydania na GitHub.' : 'Nie udało się sprawdzić aktualizacji. Spróbuj później.');
  const release = await response.json();
  if (release.draft || release.prerelease || !parseVersion(release.tag_name)) throw new Error('Wydanie ma nieobsługiwany numer wersji.');
  return { available: newerVersion(release.tag_name, current), version: release.tag_name };
}
module.exports = { RELEASES_URL, newerVersion, checkRelease };
