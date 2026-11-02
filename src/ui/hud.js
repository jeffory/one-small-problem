// Text overlays from the shell: #hud (help line, then debug line), #seed, and the full-screen #msg for fatal errors.
export function createHud() {
  const $ = id => document.getElementById(id), msg = $('msg'), help = document.createElement('div'), debug = document.createElement('div');
  $('hud').append(help, debug);
  return {
    help: t => { help.textContent = t; },
    seed: t => { $('seed').textContent = t; },
    debug: t => { debug.textContent = t; },
    ready: () => { msg.style.display = 'none'; },
    fatal: t => { msg.textContent = t; msg.style.display = 'flex'; },
  };
}
