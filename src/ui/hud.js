// Text overlays from the shell: #hud (help line, then debug line), #seed, and the full-screen #msg for fatal errors.
// mode() picks which play overlays show: 'none' on the title and the end screen, 'opening' just the prompt and crosshair.
// R2: the help line shows as each run starts and hides once the run has HELP_TIME s of play time (deaths don't reset it); the
// pause menu carries the controls after that.
export const HELP_TIME = 20;

export function createHud() {
  const $ = id => document.getElementById(id), msg = $('msg'), help = document.createElement('div'), debug = document.createElement('div');
  const stat = $('stat'), prompt = $('prompt'), flash = $('flash'), x = $('x'), num = document.createElement('span'), rest = document.createTextNode('');
  const MODES = { none: [], opening: [prompt, x], play: [stat, prompt, flash, x, help] };
  $('hud').append(help, debug);
  let low = false, shown = false;
  return {
    help: t => { if (help.textContent !== t) help.textContent = t; },
    seed: t => { $('seed').textContent = t; },
    mode: m => { for (const e of MODES.play) e.style.display = MODES[m].includes(e) ? '' : 'none'; },
    status: ({ hp, cells, weapon }) => {
      if (!shown) { shown = true; stat.append('HEALTH ', num, rest); } // M8: only the number turns red, below 25
      const h = String(hp), t = `   CELLS ${cells}   ${weapon}`;
      if (num.textContent !== h) num.textContent = h;
      if (rest.data !== t) rest.data = t;
      if (low !== hp < 25) { low = hp < 25; num.style.color = low ? '#b8301a' : ''; }
    },
    prompt: t => { if (prompt.textContent !== t) prompt.textContent = t; },
    flash: t => {
      const d = document.createElement('div'); d.textContent = t; flash.append(d);
      while (flash.childNodes.length > 3) flash.firstChild.remove();
      setTimeout(() => d.remove(), 2000);
    },
    debug: t => { debug.textContent = t; },
    ready: () => { msg.style.display = 'none'; },
    fatal: t => {
      msg.textContent = t; msg.style.display = 'flex';
      for (const e of [stat, prompt, flash, x, $('title'), $('end'), $('pause')]) e.style.display = 'none';
    },
  };
}
