// The escape, level 2 (pure): its tables and helpers. The state changes they drive live in fight.js.

// The knock-out. call: the most seconds from Houston picking up to the knock-out, the fallback when no radio ends the cut-off line
// first (the bot, replays, Node). The rest time the wake in the cell, which comes later; for now the knock-out ends the run.
// out: seconds of black; stamp: seconds into the black that text stamps; fade: seconds the light takes to come back; down: seconds
// on the floor, the look locked, eye m above it and pitched pitch rad, coming level; getUp: seconds to stand; hp: health on waking.
export const KO = { call: 30, out: 5, stamp: 1.5, fade: 1, down: 3, getUp: .8, eye: .3, pitch: .6, hp: 70, text: 'ANOTHER SMALL PROBLEM' };
