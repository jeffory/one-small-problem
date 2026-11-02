// Text overlays from the shell: #hud (help line, then debug line), #seed, and the full-screen #msg for fatal errors.
export function createHud() {
  const $ = id => document.getElementById(id), msg = $('msg'), help = document.createElement('div'), debug = document.createElement('div');
  const stat = $('stat'), prompt = $('prompt'), flash = $('flash');
  $('hud').append(help, debug);
  return {
    help: t => { help.textContent = t; },
    seed: t => { $('seed').textContent = t; },
    status: ({ hp, cells, weapon }) => {
      const t = `HEALTH ${hp}   CELLS ${cells}   ${weapon}`;
      if (stat.textContent !== t) stat.textContent = t;
      stat.style.color = hp < 25 ? '#b8301a' : '';
    },
    prompt: t => { if (prompt.textContent !== t) prompt.textContent = t; },
    flash: t => {
      const d = document.createElement('div'); d.textContent = t; flash.append(d);
      while (flash.childNodes.length > 3) flash.firstChild.remove();
      setTimeout(() => d.remove(), 2000);
    },
    debug: t => { debug.textContent = t; },
    ready: () => { msg.style.display = 'none'; },
    fatal: t => { msg.textContent = t; msg.style.display = 'flex'; },
  };
}
