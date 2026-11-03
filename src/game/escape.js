// The escape, level 2 (pure): its tables and helpers. The state changes they drive live in fight.js.

// The break-out in the prison cell. reach: how near (m) the bars E works; face: how squarely (forward . the direction to the bars)
// you must face them; guard, open: seconds from the bang to the guard coming and to the bars dropping; idle: seconds between the
// Switchboard's nudges in the shut cell; pa: seconds between its notices once you are out.
export const BREAK = { reach: 2, face: .5, guard: 3, open: 4.5, idle: 20, pa: 40 };

// The exit lift at the end of the prison. reach: how near (m) E takes you up to the climb.
export const EXIT = { reach: 2.5 };
export const exitOf = B => B.props.find(q => q.kind === 'exit');

// The knock-out. call: the most seconds from Houston picking up to the knock-out, the fallback when no radio ends the cut-off line
// first (the bot, replays, Node). The rest time the wake in the cell, which comes later; for now the knock-out ends the run.
// out: seconds of black; stamp: seconds into the black that text stamps; fade: seconds the light takes to come back; down: seconds
// on the floor, the look locked, eye m above it and pitched pitch rad, coming level; getUp: seconds to stand; hp: health on waking.
export const KO = { call: 30, out: 5, stamp: 1.5, fade: 1, down: 3, getUp: .8, eye: .3, pitch: .6, hp: 70, text: 'ANOTHER SMALL PROBLEM' };
