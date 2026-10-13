// Merit and demerit guide shown on the website and used as quick buttons on the admin page.
// Edit this list to change the guide. Points are always positive numbers.
// Placement points from the camp score sheet. 1st to 6th place, in order.
// 6 troops compete, so every scale needs 6 values. 'major' steps down by 20 from 200 to 100.
export const PLACEMENT_SCALES = {
  major: [200, 180, 160, 140, 120, 100],
  minor: [100, 85, 50, 25, 10, 0],
};

// Which game uses which scale (names must match the game names exactly).
export const GAME_SCALE = {
  'Whistle Game': 'major',
  'Amazing Race': 'major',
  'Trashion Show': 'major',
  'Volleyball': 'major',
  'Yell': 'major',
  'Flag Raising': 'minor',
  'Games': 'minor',
};

/**
 * Turns judge averages into placement points. Tied troops share the better place
 * (two troops tied for 1st both get 1st-place points, the next troop is 3rd).
 * A troop with no average (nobody scored it) gets 0.
 * entries: [{ id, average }]  ->  Map(id -> points)
 */
export function placementPoints(entries, scaleName) {
  const scale = PLACEMENT_SCALES[scaleName];
  const out = new Map(entries.map((e) => [e.id, 0]));
  if (!scale) return out;
  const ranked = entries
    .filter((e) => e.average !== null && e.average !== undefined)
    .map((e) => ({ id: e.id, avg: Math.round(Number(e.average) * 100) / 100 }))
    .sort((a, b) => b.avg - a.avg);
  ranked.forEach((e, i) => {
    e.rank = i > 0 && e.avg === ranked[i - 1].avg ? ranked[i - 1].rank : i + 1;
    out.set(e.id, scale[e.rank - 1] ?? 0);
  });
  return out;
}

export const RULES = {
  placement: { scales: PLACEMENT_SCALES, games: GAME_SCALE },
  merits: [
    { label: 'Punctuality', points: 10 },
    { label: 'Teamwork', points: 10 },
    { label: 'Cleanest place', points: 50 },
    { label: 'Volunteerism', points: 15 },
    { label: 'Good sports', points: 15 },
    { label: 'Generosity', points: 50 },
  ],
  demerits: [
    { label: 'Late / incompleteness', points: 15 },
    { label: 'Littering / untidiness', points: 15 },
    { label: 'Disrespecting', points: 50 },
    { label: 'Violating camp rules', points: 50 },
    { label: 'Arguing / causing disturbance', points: 20 },
    { label: 'Tampering with camp materials', points: 50 },
  ],
};
