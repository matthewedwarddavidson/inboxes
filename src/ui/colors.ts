// Pastel colour palette for boxes, keyed by their size (area / clue value).
// Gives the board a soft, varied, papery look.

export interface BoxColor {
  fill: string;
  stroke: string;
}

const PALETTE: Record<number, BoxColor> = {
  2: { fill: '#f6c9c2', stroke: '#d9887b' }, // coral
  3: { fill: '#f8dcb4', stroke: '#d9a663' }, // apricot
  4: { fill: '#f2ecab', stroke: '#c7ba57' }, // butter
  5: { fill: '#d8e8ac', stroke: '#9cbc5f' }, // pear
  6: { fill: '#bfe4c1', stroke: '#78bc84' }, // mint
  7: { fill: '#b7e4d9', stroke: '#6cbcac' }, // aqua
  8: { fill: '#bcd9ef', stroke: '#78a8d0' }, // sky
  9: { fill: '#c4ccf0', stroke: '#828fce' }, // periwinkle
  10: { fill: '#d7c7ed', stroke: '#9d85c9' }, // lavender
  11: { fill: '#e7c6e6', stroke: '#bd84bd' }, // orchid
  12: { fill: '#f3c6d8', stroke: '#cf7ea0' }, // rose
};

function fallback(value: number): BoxColor {
  const hue = (value * 37) % 360;
  return { fill: `hsl(${hue} 62% 84%)`, stroke: `hsl(${hue} 46% 60%)` };
}

export function colorForValue(value: number): BoxColor {
  return PALETTE[value] ?? fallback(value);
}
