// Merit and demerit guide shown on the website and used as quick buttons on the admin page.
// Edit this list to change the guide. Points are always positive numbers.
// Default placement points (1st place first). Organizers change them on the Games & guide page;
// these are only used until the placement_points table exists.
export const PLACEMENT_DEFAULT = [200, 180, 160, 140, 120, 100];

/**
 * Turns judge averages into placement points. Tied troops share the better place
 * (two troops tied for 1st both get 1st-place points, the next troop is 3rd).
 * A troop with no average (nobody scored it) gets 0, and so does any place past the end of the scale.
 * entries: [{ id, average }], scale: [points for 1st, 2nd, ...]  ->  Map(id -> points)
 */
export function placementPoints(entries, scale) {
  const out = new Map(entries.map((e) => [e.id, 0]));
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
  placement: { scale: PLACEMENT_DEFAULT },
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
