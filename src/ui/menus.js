// The full-screen menus from the shell: the title (#title) and the end screen (#end). Showing one hides the other, and hide()
// hides both. They take clicks; the HUD under them doesn't.
import { fmtTime } from './score.js';
import { GOLF_TOTAL } from '../game/fight.js';

export function createMenus({ onNew, onBack }) {
  const $ = id => document.getElementById(id), title = $('title'), end = $('end'), stats = $('stats'), link = $('link'), code = $('code'), copy = $('copy');
  const show = el => { for (const e of [title, end]) e.style.display = e === el ? 'flex' : 'none'; };
  // A pressed button gives its focus back, so Space (jump) or Enter in play never presses it again.
  const press = (el, f) => el.addEventListener('click', () => { el.blur(); f(); });
  press($('new'), onNew); press($('back'), onBack);
  let seed = '';
  // Copy the seed code; with no clipboard (or a refusal) select the code so the player can copy it by hand.
  copy.addEventListener('click', () => {
    const pick = () => { const r = document.createRange(), s = getSelection(); r.selectNodeContents(code); s.removeAllRanges(); s.addRange(r); };
    try { navigator.clipboard.writeText(seed).catch(pick); } catch { pick(); }
  });
  return {
    // The title, with the URL's seed (if any) as its mission; title(false) just hides it.
    title(on, mission) {
      if (!on) { title.style.display = 'none'; return; }
      $('mission').textContent = mission ? 'Mission #' + mission : '';
      show(title);
    },
    // The mission report: {time, kills, golf, link, seed, best, isNew}. A share link where there is one, else the seed code.
    end(r) {
      const lines = ['TIME ' + fmtTime(r.time)]; seed = r.seed;
      if (r.isNew) lines.push('NEW BEST'); else if (r.best !== null) lines.push('BEST ' + fmtTime(r.best));
      lines.push('KILLS ' + r.kills, `GOLF BALLS ${r.golf}/${GOLF_TOTAL}`);
      stats.replaceChildren(...lines.map(t => { const d = document.createElement('div'); d.textContent = t; return d; }));
      if (r.link) { link.href = link.textContent = r.link; code.textContent = ''; }
      else { code.textContent = r.seed; link.removeAttribute('href'); link.textContent = ''; }
      link.style.display = r.link ? '' : 'none'; code.style.display = copy.style.display = r.link ? 'none' : '';
      show(end);
    },
    hide: () => show(null),
  };
}
