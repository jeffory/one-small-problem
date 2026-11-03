// Text overlays from the shell: #hud (help line, then debug line), #seed, the opening's title #stamp, the radio's subtitle #sub
// and the full-screen #msg for fatal errors. mode() picks which play overlays show: 'none' on the title and the end screen, 'opening' just the prompt and
// crosshair; any mode but 'play' also takes the stamp down.
// R2: the help line shows as each run starts and hides once the run has HELP_TIME s of play time (deaths don't reset it); the
// pause menu carries the controls after that. STAMP_TIME: seconds the title stays stamped on the screen.
export const HELP_TIME = 20, STAMP_TIME = 3.5;

export function createHud() {
  const $ = id => document.getElementById(id), msg = $('msg'), help = document.createElement('div'), debug = document.createElement('div');
  const stat = $('stat'), prompt = $('prompt'), flash = $('flash'), way = $('way'), wa = $('wa'), wd = $('wd'), x = $('x'), stamp = $('stamp'), sub = $('sub'), num = document.createElement('span'), rest = document.createTextNode('');
  const MODES = { none: [], opening: [prompt, x], play: [stat, prompt, flash, way, x, help] };
  $('hud').append(help, debug);
  let low = false, wangle = '', wtext = '', shown = false, stampT = 0;
  const unstamp = () => { clearTimeout(stampT); stamp.style.display = 'none'; };
  return {
    help: t => { if (help.textContent !== t) help.textContent = t; },
    seed: t => { $('seed').textContent = t; },
    mode: m => { for (const e of MODES.play) e.style.display = MODES[m].includes(e) ? '' : 'none'; if (m !== 'play') unstamp(); },
    // The title drop: ONE SMALL PROBLEM slams on (the shell's CSS animation, from 1.8x and clear over .18 s, runs as it shows).
    stamp: () => { unstamp(); stamp.style.display = 'block'; stampT = setTimeout(unstamp, STAMP_TIME * 1000); },
    status: ({ hp, cells, weapon }) => {
      if (!shown) { shown = true; stat.append('HEALTH ', num, rest); } // M8: only the number turns red, below 25
      const h = String(hp), t = `   CELLS ${cells}   ${weapon}`;
      if (num.textContent !== h) num.textContent = h;
      if (rest.data !== t) rest.data = t;
      if (low !== hp < 25) { low = hp < 25; num.style.color = low ? '#b8301a' : ''; }
    },
    // The wayfinding arrow: null hides it; { ang, m } turns the chevron (clockwise degrees) and writes the metres, each only on change.
    way: w => {
      way.classList.toggle('on', !!w); if (!w) return;
      const r = `rotate(${Math.round(w.ang * 180 / Math.PI)}deg)`, t = `${w.m} m`;
      if (r !== wangle) { wangle = r; wa.style.transform = r; }
      if (t !== wtext) { wtext = t; wd.textContent = t; }
    },
    prompt: t => { if (prompt.textContent !== t) prompt.textContent = t; },
    // The radio's subtitle, "SPEAKER: line", with the red keyed dot while keyed ('' takes it down).
    sub: (t, keyed) => { if (sub.textContent !== t) sub.textContent = t; sub.classList.toggle('on', !!keyed); },
    flash: t => {
      const d = document.createElement('div'); d.textContent = t; flash.append(d);
      while (flash.childNodes.length > 3) flash.firstChild.remove();
      setTimeout(() => d.remove(), 2000);
    },
    debug: t => { debug.textContent = t; },
    ready: () => { msg.style.display = 'none'; },
    fatal: t => {
      msg.textContent = t; msg.style.display = 'flex';
      for (const e of [stat, prompt, flash, way, x, stamp, sub, $('title'), $('end'), $('pause')]) e.style.display = 'none';
    },
  };
}
