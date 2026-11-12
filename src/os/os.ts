import './os.css';
import { profile, projects, TAGS, type Project } from '../data';
import { aboutBody, esc, projectBody } from '../content';
import { GLYPHS, ICONS, WALLPAPER, docIcon, folderIcon, svgUrl } from './assets';

const EASE_OUT = 'cubic-bezier(0.2, 0.9, 0.25, 1)';
const EASE_IN_OUT = 'cubic-bezier(0.65, 0, 0.35, 1)';
const SCREEN_W = 1280;
const SCREEN_H = 800;
const MENU_H = 26;

type AppId = 'finder' | 'reader' | 'notes' | 'contacts' | 'terminal';
const APP_NAMES: Record<AppId, string> = { finder: 'Projects', reader: 'Reader', notes: 'Notes', contacts: 'Contacts', terminal: 'Terminal' };

interface Win {
  id: string;
  app: AppId;
  el: HTMLElement;
  minimized: boolean;
  saved?: { left: string; top: string; width: string; height: string };
}

const img = (svg: string, cls = '', alt = '') => `<img class="${cls}" src="${svgUrl(svg)}" alt="${esc(alt)}" draggable="false">`;

export class PortfolioOS {
  private screen: HTMLElement;
  private winLayer: HTMLElement;
  private dock: HTMLElement;
  private wins = new Map<string, Win>();
  private z = 10;
  private active: Win | null = null;
  private clockTimer = 0;
  private booted = false;
  private full = false;

  constructor(private root: HTMLElement, private onExit: () => void) {
    this.screen = root.querySelector('.os-screen')!;
    this.screen.innerHTML = `
      <div class="os-wall" style="background-image:url('${svgUrl(WALLPAPER)}')"></div>
      <header class="mb">
        <span class="mb-logo">${GLYPHS.logo}</span>
        <b class="mb-app">Projects</b>
        <span class="mb-menu">File</span><span class="mb-menu">Edit</span><span class="mb-menu">View</span>
        <span class="mb-menu">Go</span><span class="mb-menu">Window</span><span class="mb-menu">Help</span>
        <span class="mb-spacer"></span>
        <span class="mb-ico mb-batt">${GLYPHS.battery}<small>87%</small></span>
        <span class="mb-ico">${GLYPHS.wifi}</span>
        <button class="mb-ico mb-search" title="Search (Ctrl+K)">${GLYPHS.search}</button>
        <span class="mb-ico">${GLYPHS.control}</span>
        <span class="mb-clock"></span>
        <button class="mb-exit" title="Back to the desk (Esc)">⏏&nbsp; Desk</button>
      </header>
      <div class="desk-icons"></div>
      <div class="wins"></div>
      <nav class="dock" aria-label="Dock"><div class="dock-shelf"></div></nav>
      <div class="notifs"></div>
      <div class="spot" hidden>
        <div class="spot-box">
          <div class="spot-in">${GLYPHS.search}<input placeholder="Spotlight Search" spellcheck="false" aria-label="Search projects"></div>
          <ul class="spot-res"></ul>
        </div>
      </div>`;
    this.winLayer = this.screen.querySelector('.wins')!;
    this.dock = this.screen.querySelector('.dock')!;

    this.screen.querySelector('.mb-exit')!.addEventListener('click', () => this.onExit());
    this.screen.querySelector('.mb-search')!.addEventListener('click', () => this.openSpotlight());
    this.buildDesktopIcons();
    this.buildDock();
    this.bindSpotlight();

    // clicking empty desktop deselects icons and blurs windows
    this.screen.querySelector('.os-wall')!.addEventListener('pointerdown', () => {
      this.screen.querySelectorAll('.desk-icon.sel').forEach((e) => e.classList.remove('sel'));
    });

    addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === ' ')) {
        e.preventDefault();
        this.openSpotlight();
      } else if (e.key === 'Escape') {
        if (!this.spot.hidden) this.closeSpotlight();
        else this.onExit();
      }
    });
  }

  get isOpen() {
    return this.root.classList.contains('open');
  }
  private get spot() {
    return this.screen.querySelector<HTMLElement>('.spot')!;
  }
  private get scale() {
    return this.full ? 1 : parseFloat(this.root.style.getPropertyValue('--os-scale')) || 1;
  }

  /* ================================================================ show / hide */

  /** rect = the 3D display on screen; null → full viewport (phones). */
  show(rect: DOMRect | null) {
    const s = this.root.style;
    this.full = !rect;
    if (rect) {
      Object.assign(s, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
      s.setProperty('--os-scale', String(rect.width / SCREEN_W));
    } else {
      Object.assign(s, { left: '0', top: '0', width: '100vw', height: '100dvh' });
      s.setProperty('--os-scale', '1');
    }
    this.root.classList.toggle('full', this.full);
    this.root.classList.add('open');
    this.tick();
    clearInterval(this.clockTimer);
    this.clockTimer = window.setInterval(() => this.tick(), 15_000);

    if (!this.booted) {
      this.booted = true;
      setTimeout(() => this.openFinder(this.dockItem('finder')), 550);
      setTimeout(
        () =>
          this.notify(
            ICONS.projects,
            'Portfolio',
            `Welcome to ${profile.name}'s laptop`,
            this.full ? 'Tap a folder to open a project. Tap Desk to get back.' : 'Double-click a folder to open a project. Press Esc to get back to the desk.',
          ),
        1500,
      );
    }
  }

  hide() {
    this.root.classList.remove('open');
    clearInterval(this.clockTimer);
    this.closeSpotlight();
  }

  private tick() {
    const d = new Date();
    const day = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    this.screen.querySelector('.mb-clock')!.textContent = `${day}  ${time}`;
  }

  /* ================================================================ desktop & dock */

  private buildDesktopIcons() {
    const wrap = this.screen.querySelector('.desk-icons')!;
    const items: { icon: string; label: string; open: (from: Element) => void }[] = [
      { icon: folderIcon(), label: 'Projects', open: (f) => this.openFinder(f) },
      ...projects
        .filter((p) => p.onDesk)
        .map((p) => ({ icon: folderIcon(TAGS[p.tags[0]] ?? '#3d9df3'), label: p.title, open: (f: Element) => this.openProject(p, f) })),
      { icon: docIcon('TXT', '#8e8e93'), label: 'About me.txt', open: (f) => this.openNotes(f) },
      { icon: docIcon('VCF', '#a2845e'), label: 'Contact.vcf', open: (f) => this.openContacts(f) },
    ];
    for (const it of items) {
      const b = document.createElement('button');
      b.className = 'desk-icon';
      b.innerHTML = `${img(it.icon, 'di-img')}<span>${esc(it.label)}</span>`;
      this.bindOpen(b, () => it.open(b), () => {
        wrap.querySelectorAll('.sel').forEach((e) => e.classList.remove('sel'));
        b.classList.add('sel');
      });
      wrap.append(b);
    }
  }

  /** Real desktops open on double-click; touch screens open on a single tap. */
  private bindOpen(el: HTMLElement, open: () => void, select?: () => void) {
    el.addEventListener('click', (e) => {
      select?.();
      if (this.full || (e as PointerEvent).pointerType === 'touch') open();
    });
    el.addEventListener('dblclick', open);
  }

  private buildDock() {
    const shelf = this.dock.querySelector('.dock-shelf')!;
    const items: { id: string; icon: string; label: string; run: (el: HTMLElement) => void; sep?: boolean }[] = [
      { id: 'finder', icon: ICONS.projects, label: 'Projects', run: (el) => this.openFinder(el) },
      { id: 'notes', icon: ICONS.notes, label: 'Notes', run: (el) => this.openNotes(el) },
      { id: 'contacts', icon: ICONS.contacts, label: 'Contacts', run: (el) => this.openContacts(el) },
      { id: 'terminal', icon: ICONS.terminal, label: 'Terminal', run: (el) => this.openTerminal(el) },
      { id: 'github', icon: ICONS.github, label: 'GitHub ↗', run: () => window.open(profile.links[0].href, '_blank', 'noopener') },
      { id: 'trash', icon: ICONS.trash, label: 'Trash', run: () => {}, sep: true },
    ];
    for (const it of items) {
      if (it.sep) shelf.insertAdjacentHTML('beforeend', '<span class="dock-sep"></span>');
      const b = document.createElement('button');
      b.className = 'dock-item';
      b.dataset.app = it.id;
      b.innerHTML = `<span class="dock-tip">${esc(it.label)}</span>${img(it.icon, 'dock-img', it.label)}<i class="dock-dot"></i>`;
      b.addEventListener('click', () => {
        // restore a minimised window first, like a real dock
        const min = [...this.wins.values()].find((w) => w.app === it.id && w.minimized);
        if (min) this.restore(min);
        else it.run(b);
      });
      shelf.append(b);
    }

    // magnification
    const base = 52, max = 82, reach = 150;
    const dockItems = () => [...shelf.querySelectorAll<HTMLElement>('.dock-item')];
    this.dock.addEventListener('pointermove', (e) => {
      if (this.full) return;
      for (const el of dockItems()) {
        const r = el.getBoundingClientRect();
        const d = Math.abs(e.clientX - (r.left + r.width / 2)) / this.scale;
        const k = Math.max(0, 1 - d / reach);
        el.style.setProperty('--size', `${base + (max - base) * Math.sin((k * Math.PI) / 2) ** 2}px`);
      }
    });
    this.dock.addEventListener('pointerleave', () => dockItems().forEach((el) => el.style.removeProperty('--size')));
  }

  private dockItem(app: string) {
    return this.dock.querySelector<HTMLElement>(`.dock-item[data-app="${app}"]`)!;
  }

  private updateDock() {
    for (const el of this.dock.querySelectorAll<HTMLElement>('.dock-item')) {
      el.classList.toggle('running', [...this.wins.values()].some((w) => w.app === el.dataset.app));
    }
    this.screen.querySelector('.mb-app')!.textContent = this.active ? APP_NAMES[this.active.app] : 'Projects';
  }

  private bounce(app: AppId) {
    if ([...this.wins.values()].some((w) => w.app === app)) return;
    this.dockItem(app === 'reader' ? 'finder' : app)?.animate(
      [{ transform: 'translateY(0)' }, { transform: 'translateY(-22px)' }, { transform: 'translateY(0)' }, { transform: 'translateY(-10px)' }, { transform: 'translateY(0)' }],
      { duration: 900, easing: 'ease-out' },
    );
  }

  /* ================================================================ window manager */

  /** Centre of an element in the OS's own 1280×800 coordinates. */
  private local(el: Element | null) {
    if (!el) return { x: SCREEN_W / 2, y: SCREEN_H };
    const r = el.getBoundingClientRect();
    const s = this.screen.getBoundingClientRect();
    return { x: (r.left + r.width / 2 - s.left) / this.scale, y: (r.top + r.height / 2 - s.top) / this.scale };
  }

  private openWindow(opts: { id: string; app: AppId; title: string; body: string; cls?: string; w: number; h: number; x?: number; y?: number; toolbar?: string; from?: Element | null }) {
    const existing = this.wins.get(opts.id);
    if (existing) {
      if (existing.minimized) this.restore(existing);
      this.focus(existing);
      return existing;
    }
    this.bounce(opts.app);
    const n = this.wins.size;
    const x = opts.x ?? Math.round((SCREEN_W - opts.w) / 2 - 60 + n * 28);
    const y = opts.y ?? Math.round(MENU_H + 40 + n * 24);
    const el = document.createElement('section');
    el.className = `win ${opts.cls ?? ''}`;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', opts.title);
    Object.assign(el.style, { left: `${x}px`, top: `${y}px`, width: `${opts.w}px`, height: `${opts.h}px` });
    el.innerHTML = `
      <div class="win-bar">
        <div class="lights">
          <button class="l close" aria-label="Close"><svg viewBox="0 0 8 8"><path d="M1.5 1.5l5 5M6.5 1.5l-5 5"/></svg></button>
          <button class="l min" aria-label="Minimise"><svg viewBox="0 0 8 8"><path d="M1 4h6"/></svg></button>
          <button class="l max" aria-label="Zoom"><svg viewBox="0 0 8 8"><path d="M1.5 6.5V3l3.5 3.5zM6.5 1.5V5L3 1.5z" fill="currentColor" stroke="none"/></svg></button>
        </div>
        ${opts.toolbar ?? `<span class="win-title">${esc(opts.title)}</span>`}
      </div>
      <div class="win-body">${opts.body}</div>`;
    const win: Win = { id: opts.id, app: opts.app, el, minimized: false };
    el.querySelector('.close')!.addEventListener('click', (e) => (e.stopPropagation(), this.close(win)));
    el.querySelector('.min')!.addEventListener('click', (e) => (e.stopPropagation(), this.minimize(win)));
    el.querySelector('.max')!.addEventListener('click', (e) => (e.stopPropagation(), this.toggleMax(win)));
    el.querySelector('.win-bar')!.addEventListener('dblclick', (e) => {
      if (!(e.target as HTMLElement).closest('button, input, a')) this.toggleMax(win);
    });
    el.addEventListener('pointerdown', () => this.focus(win), true);
    this.makeDraggable(win);
    this.winLayer.append(el);
    this.wins.set(win.id, win);
    this.focus(win);

    // grow out of whatever was clicked (icon, dock, link)
    const o = this.local(opts.from ?? null);
    el.style.transformOrigin = `${o.x - x}px ${o.y - y}px`;
    el.animate(
      [
        { transform: 'scale(0.12)', opacity: 0, filter: 'blur(6px)' },
        { transform: 'scale(1)', opacity: 1, filter: 'blur(0)' },
      ],
      { duration: 520, easing: EASE_OUT },
    );
    return win;
  }

  private focus(win: Win) {
    if (this.active === win && win.el.style.zIndex === String(this.z)) return;
    win.el.style.zIndex = String(++this.z);
    this.active = win;
    for (const w of this.wins.values()) w.el.classList.toggle('inactive', w !== win);
    this.updateDock();
  }

  private close(win: Win) {
    const a = win.el.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0.94)', opacity: 0 }], { duration: 220, easing: 'ease-in' });
    this.wins.delete(win.id);
    if (this.active === win) this.active = null;
    const next = [...this.wins.values()].filter((w) => !w.minimized).sort((a, b) => +b.el.style.zIndex - +a.el.style.zIndex)[0];
    if (next) this.focus(next);
    this.updateDock();
    a.onfinish = () => win.el.remove();
  }

  private minimize(win: Win) {
    const target = this.local(this.dockItem(win.app === 'reader' ? 'finder' : win.app));
    const r = { x: win.el.offsetLeft, y: win.el.offsetTop };
    win.el.style.transformOrigin = `${target.x - r.x}px ${target.y - r.y}px`;
    const a = win.el.animate(
      [
        { transform: 'scale(1)', opacity: 1 },
        { transform: 'scale(0.04, 0.02)', opacity: 0.2 },
      ],
      { duration: 480, easing: EASE_IN_OUT },
    );
    a.onfinish = () => {
      win.el.style.display = 'none';
      win.minimized = true;
      if (this.active === win) this.active = null;
      this.updateDock();
    };
  }

  private restore(win: Win) {
    win.el.style.display = '';
    win.minimized = false;
    this.focus(win);
    win.el.animate(
      [
        { transform: 'scale(0.04, 0.02)', opacity: 0.2 },
        { transform: 'scale(1)', opacity: 1 },
      ],
      { duration: 480, easing: EASE_OUT },
    );
  }

  private toggleMax(win: Win) {
    const s = win.el.style;
    const to = win.saved
      ? win.saved
      : { left: '0px', top: `${MENU_H}px`, width: `${SCREEN_W}px`, height: `${SCREEN_H - MENU_H - 78}px` };
    if (!win.saved) win.saved = { left: s.left, top: s.top, width: s.width, height: s.height };
    else win.saved = undefined;
    win.el.classList.add('animating');
    Object.assign(s, to);
    setTimeout(() => win.el.classList.remove('animating'), 420);
  }

  private makeDraggable(win: Win) {
    const bar = win.el.querySelector<HTMLElement>('.win-bar')!;
    bar.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('button, input, a') || this.full) return;
      const sx = e.clientX, sy = e.clientY;
      const ox = win.el.offsetLeft, oy = win.el.offsetTop;
      bar.setPointerCapture(e.pointerId);
      bar.classList.add('dragging');
      const move = (ev: PointerEvent) => {
        win.el.style.left = `${ox + (ev.clientX - sx) / this.scale}px`;
        win.el.style.top = `${Math.max(MENU_H, oy + (ev.clientY - sy) / this.scale)}px`;
      };
      const up = () => {
        bar.classList.remove('dragging');
        bar.removeEventListener('pointermove', move);
        bar.removeEventListener('pointerup', up);
      };
      bar.addEventListener('pointermove', move);
      bar.addEventListener('pointerup', up);
    });
  }

  /* ================================================================ notifications & spotlight */

  private notify(icon: string, app: string, title: string, body: string) {
    const n = document.createElement('div');
    n.className = 'notif';
    n.innerHTML = `${img(icon, 'n-ico')}<div><p class="n-app">${esc(app)} <span>now</span></p><p class="n-title">${esc(title)}</p><p class="n-body">${esc(body)}</p></div>`;
    n.addEventListener('click', () => dismiss());
    this.screen.querySelector('.notifs')!.append(n);
    n.animate([{ transform: 'translateX(120%)' }, { transform: 'translateX(0)' }], { duration: 650, easing: EASE_OUT });
    const dismiss = () => {
      const a = n.animate([{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(120%)', opacity: 0 }], { duration: 450, easing: 'ease-in' });
      a.onfinish = () => n.remove();
    };
    setTimeout(dismiss, 8000);
  }

  private bindSpotlight() {
    const input = this.spot.querySelector('input')!;
    const list = this.spot.querySelector('.spot-res')!;
    const entries = [
      ...projects.map((p) => ({ label: p.title, sub: p.tagline, icon: folderIcon(TAGS[p.tags[0]] ?? '#3d9df3'), run: () => this.openProject(p, null) })),
      { label: 'About me', sub: profile.role, icon: ICONS.notes, run: () => this.openNotes(null) },
      { label: 'Contacts', sub: 'GitHub, location', icon: ICONS.contacts, run: () => this.openContacts(null) },
      { label: 'Terminal', sub: 'zsh', icon: ICONS.terminal, run: () => this.openTerminal(null) },
    ];
    let sel = 0;
    const render = () => {
      const q = input.value.trim().toLowerCase();
      const res = entries.filter((e) => !q || (e.label + ' ' + e.sub).toLowerCase().includes(q)).slice(0, 7);
      sel = Math.min(sel, Math.max(0, res.length - 1));
      list.innerHTML = res
        .map((e, i) => `<li class="${i === sel ? 'on' : ''}" data-i="${i}">${img(e.icon, 'sr-ico')}<span><b>${esc(e.label)}</b><small>${esc(e.sub)}</small></span></li>`)
        .join('');
      list.querySelectorAll('li').forEach((li) =>
        li.addEventListener('click', () => {
          res[+li.dataset.i!].run();
          this.closeSpotlight();
        }),
      );
      return res;
    };
    let current = render();
    input.addEventListener('input', () => ((sel = 0), (current = render())));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') sel = Math.min(sel + 1, current.length - 1);
      else if (e.key === 'ArrowUp') sel = Math.max(sel - 1, 0);
      else if (e.key === 'Enter' && current[sel]) {
        current[sel].run();
        this.closeSpotlight();
        return;
      } else return;
      e.preventDefault();
      current = render();
    });
    this.spot.addEventListener('pointerdown', (e) => {
      if (e.target === this.spot) this.closeSpotlight();
    });
  }

  private openSpotlight() {
    const s = this.spot;
    s.hidden = false;
    const input = s.querySelector('input')!;
    input.value = '';
    input.dispatchEvent(new Event('input'));
    s.querySelector('.spot-box')!.animate([{ transform: 'scale(0.96)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 260, easing: EASE_OUT });
    input.focus();
  }
  private closeSpotlight() {
    this.spot.hidden = true;
  }

  /* ================================================================ apps */

  openFinder(from: Element | null, filter = 'all') {
    const toolbar = `
      <div class="tb-nav"><button class="tb-btn" aria-label="Back">${GLYPHS.chevL}</button><button class="tb-btn" aria-label="Forward" disabled>${GLYPHS.chevR}</button></div>
      <span class="tb-title">Projects</span>
      <span class="tb-spacer"></span>
      <div class="tb-seg"><button class="tb-btn on" data-view="grid" aria-label="Icons">${GLYPHS.grid}</button><button class="tb-btn" data-view="list" aria-label="List">${GLYPHS.list}</button></div>
      <label class="tb-search">${GLYPHS.search}<input placeholder="Search" spellcheck="false" aria-label="Search projects"></label>`;
    const side = `
      <aside class="fd-side">
        <h6>Favourites</h6>
        <button data-f="all" class="on">${img(folderIcon('#8e8e93'), 'fs-ico')}All Projects</button>
        <button data-f="featured">${img(folderIcon('#ff9f0a'), 'fs-ico')}Featured</button>
        <button data-f="recent">${img(folderIcon('#64d2ff'), 'fs-ico')}2026</button>
        <h6>Locations</h6>
        <a href="${profile.links[0].href}" target="_blank" rel="noopener">${img(ICONS.github, 'fs-ico')}GitHub <span class="ext">${GLYPHS.ext}</span></a>
        <h6>Tags</h6>
        ${Object.entries(TAGS)
          .map(([t, c]) => `<button data-f="tag:${t}"><i class="tag" style="background:${c}"></i>${t}</button>`)
          .join('')}
      </aside>`;
    const win = this.openWindow({
      id: 'finder',
      app: 'finder',
      title: 'Projects',
      cls: 'finder',
      w: 860,
      h: 520,
      x: 150,
      y: 70,
      toolbar,
      from,
      body: `<div class="fd">${side}<section class="fd-main"><div class="fd-items"></div><footer class="fd-foot"></footer></section></div>`,
    });
    if (win.el.dataset.ready) return;
    win.el.dataset.ready = '1';

    let view: 'grid' | 'list' = 'grid';
    let f = filter;
    const items = win.el.querySelector<HTMLElement>('.fd-items')!;
    const search = win.el.querySelector<HTMLInputElement>('.tb-search input')!;
    const render = () => {
      const q = search.value.trim().toLowerCase();
      const list = projects.filter((p) => {
        if (f === 'featured' && !p.onDesk) return false;
        if (f === 'recent' && p.year !== '2026') return false;
        if (f.startsWith('tag:') && !p.tags.includes(f.slice(4))) return false;
        return !q || (p.title + ' ' + p.tagline + ' ' + p.stack.join(' ')).toLowerCase().includes(q);
      });
      items.className = `fd-items ${view}`;
      items.innerHTML =
        view === 'grid'
          ? list
              .map(
                (p) =>
                  `<button class="fd-item" data-id="${p.id}">${img(folderIcon(TAGS[p.tags[0]] ?? '#3d9df3'), 'fi-img')}<span>${esc(p.title)}</span><span class="fi-tags">${p.tags
                    .map((t) => `<i class="tag" style="background:${TAGS[t]}"></i>`)
                    .join('')}</span></button>`,
              )
              .join('')
          : `<div class="fd-row fd-head"><span>Name</span><span>Kind</span><span>Year</span><span>Tags</span></div>` +
            list
              .map(
                (p) =>
                  `<button class="fd-row fd-item" data-id="${p.id}"><span>${img(folderIcon(TAGS[p.tags[0]] ?? '#3d9df3'), 'fr-img')}${esc(p.title)}</span><span>${esc(p.kind)}</span><span>${p.year}</span><span>${p.tags
                    .map((t) => `<i class="tag" style="background:${TAGS[t]}"></i>${t}`)
                    .join(' ')}</span></button>`,
              )
              .join('');
      items.querySelectorAll<HTMLElement>('.fd-item').forEach((el) => {
        const p = projects.find((x) => x.id === el.dataset.id)!;
        this.bindOpen(el, () => this.openProject(p, el), () => {
          items.querySelectorAll('.sel').forEach((e) => e.classList.remove('sel'));
          el.classList.add('sel');
        });
      });
      win.el.querySelector('.fd-foot')!.textContent = `${list.length} item${list.length === 1 ? '' : 's'}`;
      const label = f === 'all' ? 'All Projects' : f === 'featured' ? 'Featured' : f === 'recent' ? '2026' : f.slice(4);
      win.el.querySelector('.tb-title')!.textContent = label;
    };
    win.el.querySelectorAll<HTMLElement>('.fd-side button').forEach((b) =>
      b.addEventListener('click', () => {
        win.el.querySelectorAll('.fd-side .on').forEach((e) => e.classList.remove('on'));
        b.classList.add('on');
        f = b.dataset.f!;
        render();
      }),
    );
    win.el.querySelectorAll<HTMLElement>('[data-view]').forEach((b) =>
      b.addEventListener('click', () => {
        win.el.querySelectorAll('[data-view]').forEach((e) => e.classList.remove('on'));
        b.classList.add('on');
        view = b.dataset.view as 'grid' | 'list';
        render();
      }),
    );
    search.addEventListener('input', render);
    items.addEventListener('pointerdown', (e) => {
      if (e.target === items) items.querySelectorAll('.sel').forEach((x) => x.classList.remove('sel'));
    });
    render();
  }

  openProject(p: Project, from: Element | null) {
    this.openWindow({
      id: `reader-${p.id}`,
      app: 'reader',
      title: `${p.title} — README.md`,
      cls: 'reader',
      w: 720,
      h: 590,
      from,
      toolbar: `<span class="tb-title">${img(docIcon('MD', p.accent), 'tb-doc')}${esc(p.title)} <small>— README.md</small></span><span class="tb-spacer"></span><a class="tb-pill" href="${p.repo}" target="_blank" rel="noopener">Open on GitHub ${GLYPHS.ext}</a>`,
      body: `<article class="md">${projectBody(p)}</article>`,
    });
  }

  openNotes(from: Element | null) {
    const notes: { t: string; d: string; html: string }[] = [
      { t: 'About me', d: 'Today', html: aboutBody() },
      {
        t: 'Skills',
        d: 'Yesterday',
        html: `<h1>Skills</h1>${Object.entries(profile.skills)
          .map(([k, v]) => `<h3>${esc(k)}</h3><ul>${v.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`)
          .join('')}`,
      },
      {
        t: 'Currently',
        d: 'Monday',
        html: `<h1>Currently</h1><ul><li>Finishing an MSc in Cybersecurity at Riga Technical University</li><li>Building <b>AgentWarden</b>, a semantic firewall for AI coding agents</li><li>Open to roles in security engineering and backend</li></ul>`,
      },
    ];
    const win = this.openWindow({
      id: 'notes',
      app: 'notes',
      title: 'Notes',
      cls: 'notes',
      w: 780,
      h: 520,
      from,
      toolbar: `<span class="tb-spacer"></span><span class="tb-title">Notes</span><span class="tb-spacer"></span>`,
      body: `<div class="nt"><aside class="nt-list">${notes
        .map((n, i) => `<button class="${i === 0 ? 'on' : ''}" data-i="${i}"><b>${esc(n.t)}</b><small>${n.d}</small></button>`)
        .join('')}</aside><article class="nt-page md">${notes[0].html}</article></div>`,
    });
    win.el.querySelectorAll<HTMLElement>('.nt-list button').forEach((b) =>
      b.addEventListener('click', () => {
        win.el.querySelectorAll('.nt-list .on').forEach((e) => e.classList.remove('on'));
        b.classList.add('on');
        const page = win.el.querySelector<HTMLElement>('.nt-page')!;
        page.innerHTML = notes[+b.dataset.i!].html;
        page.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: EASE_OUT });
      }),
    );
  }

  openContacts(from: Element | null) {
    const initials = profile.name.slice(0, 2).toUpperCase();
    this.openWindow({
      id: 'contacts',
      app: 'contacts',
      title: 'Contacts',
      cls: 'contacts',
      w: 520,
      h: 430,
      from,
      body: `<div class="ct">
        <div class="ct-avatar">${esc(initials)}</div>
        <h1>${esc(profile.name)}</h1>
        <p class="ct-role">${esc(profile.role)}</p>
        <dl>
          ${profile.links.map((l) => `<dt>${esc(l.label.toLowerCase())}</dt><dd><a href="${l.href}" target="_blank" rel="noopener">${esc(l.href.replace(/^https?:\/\//, ''))}</a></dd>`).join('')}
          <dt>location</dt><dd>${esc(profile.location)}</dd>
          <dt>education</dt><dd>${esc(profile.education)}</dd>
        </dl>
        <div class="ct-actions">${profile.links.map((l) => `<a class="tb-pill" href="${l.href}" target="_blank" rel="noopener">${esc(l.label)} ${GLYPHS.ext}</a>`).join('')}</div>
      </div>`,
    });
  }

  openTerminal(from: Element | null) {
    const user = profile.handle.toLowerCase();
    const win = this.openWindow({
      id: 'terminal',
      app: 'terminal',
      title: `${user} — -zsh — 80×24`,
      cls: 'term',
      w: 640,
      h: 400,
      from,
      body: `<div class="tm"><div class="tm-out"></div><label class="tm-line"><span class="ps1">${user}@portfolio ~ %</span><input spellcheck="false" autocomplete="off" aria-label="Terminal input"></label></div>`,
    });
    const out = win.el.querySelector<HTMLElement>('.tm-out')!;
    const input = win.el.querySelector<HTMLInputElement>('input')!;
    if (out.childElementCount) {
      input.focus();
      return;
    }
    const print = (s: string, cls = '') => {
      const d = document.createElement('div');
      if (cls) d.className = cls;
      d.textContent = s;
      out.append(d);
      const body = win.el.querySelector('.win-body')!;
      body.scrollTop = body.scrollHeight;
    };
    const run = (cmd: string) => {
      const [c, ...args] = cmd.trim().split(/\s+/);
      switch (c) {
        case '':
          break;
        case 'help':
          print('whoami   ls   open <project>   skills   contact   clear   exit');
          break;
        case 'whoami':
          print(`${profile.name} — ${profile.role}`);
          print(profile.education);
          break;
        case 'ls':
          projects.forEach((p) => print(`drwxr-xr-x  ${user}  ${p.year}  ${p.id}/`));
          break;
        case 'cat':
        case 'open': {
          const p = projects.find((x) => x.id === args[0]?.replace(/\/$/, ''));
          if (p) this.openProject(p, win.el);
          else print(`${c}: ${args[0] ?? ''}: No such file or directory`, 'err');
          break;
        }
        case 'skills':
          Object.entries(profile.skills).forEach(([k, v]) => print(`${k}: ${v.join(', ')}`));
          break;
        case 'contact':
          profile.links.forEach((l) => print(`${l.label}: ${l.href}`));
          break;
        case 'clear':
          out.innerHTML = '';
          break;
        case 'exit':
          this.close(win);
          break;
        case 'sudo':
          print(`${user} is not in the sudoers file. AgentWarden says: deny.`, 'err');
          break;
        default:
          print(`zsh: command not found: ${c}`, 'err');
      }
    };
    const last = new Date(Date.now() - 3600_000 * 5).toString().slice(0, 24);
    print(`Last login: ${last} on ttys000`);
    print('Type "help" to see what this machine can do.', 'muted');
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      print(`${user}@portfolio ~ % ${input.value}`, 'cmd');
      run(input.value);
      input.value = '';
    });
    win.el.addEventListener('click', () => input.focus());
    setTimeout(() => input.focus(), 50);
  }
}
