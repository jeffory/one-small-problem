// The full-screen menus from the shell: the title (#title) and the end screen (#end). Showing one hides the other, and hide()
// hides both. They take clicks; the HUD under them doesn't. The pause menu (#pause) is separate: it sits over the run, holds the
// settings controls and the controls text, and reports each change through onSetting.
import { cleanSettings } from './settings.js';
import { fmtTime } from './score.js';
import { GOLF_TOTAL } from '../game/fight.js';

export function createMenus({ onNew, onBack, onResume, onQuit, onSetting }) {
  const $ = id => document.getElementById(id), title = $('title'), end = $('end'), stats = $('stats'), link = $('link'), code = $('code'), copy = $('copy');
  const show = el => { for (const e of [title, end]) e.style.display = e === el ? 'flex' : 'none'; };
  // A pressed button gives its focus back, so Space (jump) or Enter in play never presses it again.
  const press = (el, f) => el.addEventListener('click', () => { el.blur(); f(); });
  press($('new'), onNew); press($('back'), onBack); press($('resume'), onResume); press($('quit'), onQuit);
  let seed = '', cur = null;
  // Each control maps to its field; a change cleans {...current, field: value} and hands it on.
  for (const [id, field] of [['res', 'res'], ['pal', 'pal'], ['vol', 'vol'], ['sens', 'sens'], ['inv', 'invert']]) {
    const el = $(id), tell = () => { cur = cleanSettings({ ...cur, [field]: el.type === 'checkbox' ? el.checked : +el.value }); onSetting(cur); };
    el.addEventListener('input', tell); el.addEventListener('change', tell);
  }
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
    // The pause menu, shown with the controls set from `settings` and the controls text `help`.
    pause(on, settings, help) {
      const p = $('pause');
      if (on) {
        cur = settings; $('res').value = settings.res; $('pal').checked = settings.pal; $('vol').value = settings.vol; $('sens').value = settings.sens;
        $('inv').checked = settings.invert; $('controls').textContent = help || '';
      }
      p.style.display = on ? 'flex' : 'none';
    },
    hide: () => show(null),
  };
}
