import { profile, projects, type Project } from './data';

const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function projectBody(p: Project) {
  return `
    <header class="doc-head" style="--accent:${p.accent}">
      <p class="doc-kind">${esc(p.kind)} · ${esc(p.year)}</p>
      <h1>${esc(p.title)}</h1>
      <p class="doc-tagline">${esc(p.tagline)}</p>
    </header>
    ${
      p.stats
        ? `<div class="doc-stats" style="--accent:${p.accent}">${p.stats
            .map((s) => `<div><strong>${esc(s.value)}</strong><span>${esc(s.label)}</span></div>`)
            .join('')}</div>`
        : ''
    }
    ${p.description.map((d) => `<p>${esc(d)}</p>`).join('')}
    <h2>Highlights</h2>
    <ul class="doc-list" style="--accent:${p.accent}">${p.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>
    ${(p.images ?? [])
      .map((im) => `<figure><img src="${im.src}" alt="${esc(im.caption)}" loading="lazy"><figcaption>${esc(im.caption)}</figcaption></figure>`)
      .join('')}
    <h2>Stack</h2>
    <div class="chips">${p.stack.map((s) => `<span>${esc(s)}</span>`).join('')}</div>
    <a class="btn" href="${p.repo}" target="_blank" rel="noopener">View on GitHub ↗</a>
  `;
}

function aboutBody() {
  return `
    <header class="doc-head" style="--accent:#f2c14e">
      <p class="doc-kind">${esc(profile.location)}</p>
      <h1>${esc(profile.name)}</h1>
      <p class="doc-tagline">${esc(profile.role)}</p>
    </header>
    <p>${esc(profile.summary)}</p>
    <p><strong>Education.</strong> ${esc(profile.education)}</p>
    <h2>Skills</h2>
    ${Object.entries(profile.skills)
      .map(([k, v]) => `<h3>${esc(k)}</h3><div class="chips">${v.map((s) => `<span>${esc(s)}</span>`).join('')}</div>`)
      .join('')}
    <h2>Contact</h2>
    <div class="chips links">${profile.links
      .map((l) => `<a class="btn" href="${l.href}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`)
      .join('')}</div>
  `;
}

export interface UICallbacks {
  onExitLaptop(): void;
  onPanelClosed(): void;
}

export class UI {
  private loader = $('#loader');
  private tooltip = $('#tooltip');
  private panel = $('#panel');
  private panelBody = $('#panel .sheet-body');
  private os = $('#os');
  private desktop = $('#os .os-desktop');
  private zTop = 10;
  private clockTimer = 0;

  constructor(private cb: UICallbacks) {
    $('#panel .sheet-close').addEventListener('click', () => this.closePanel());
    this.panel.addEventListener('click', (e) => {
      if (e.target === this.panel) this.closePanel();
    });
    $('#os .os-exit').addEventListener('click', () => cb.onExitLaptop());
    this.buildDesktop();
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (this.panelOpen) this.closePanel();
      else if (this.osOpen) {
        const wins = [...this.desktop.querySelectorAll<HTMLElement>('.win')];
        if (wins.length) wins.sort((a, b) => +b.style.zIndex - +a.style.zIndex)[0].remove();
        else cb.onExitLaptop();
      }
    });
  }

  /* ------------------------------------------------ loader */
  setProgress(p: number) {
    $('#loader .bar i').style.width = `${Math.round(p * 100)}%`;
  }
  hideLoader() {
    this.loader.classList.add('done');
    setTimeout(() => this.loader.remove(), 1200);
  }

  /* ------------------------------------------------ cinematic intro */
  showTitle() {
    const t = $('#title');
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3200);
  }
  endIntro() {
    document.body.classList.add('intro-done');
  }

  /* ------------------------------------------------ tooltip */
  setTooltip(text: string | null, x = 0, y = 0) {
    if (!text) {
      this.tooltip.classList.remove('show');
      return;
    }
    this.tooltip.textContent = text;
    this.tooltip.style.transform = `translate(${x + 16}px, ${y + 18}px)`;
    this.tooltip.classList.add('show');
  }

  setHint(visible: boolean) {
    if (matchMedia('(pointer: coarse)').matches) $('#hint').innerHTML = $('#hint').innerHTML.replaceAll('Click', 'Tap');
    $('#hint').classList.toggle('show', visible);
  }

  /* ------------------------------------------------ paper panel */
  get panelOpen() {
    return this.panel.classList.contains('open');
  }
  openProject(p: Project) {
    this.panelBody.innerHTML = projectBody(p);
    this.openPanel();
  }
  openAbout() {
    this.panelBody.innerHTML = aboutBody();
    this.openPanel();
  }
  private openPanel() {
    this.panel.scrollTop = 0;
    $('#panel .sheet').scrollTop = 0;
    this.panel.classList.add('open');
    $<HTMLButtonElement>('#panel .sheet-close').focus({ preventScroll: true });
  }
  closePanel() {
    if (!this.panelOpen) return;
    this.panel.classList.remove('open');
    this.cb.onPanelClosed();
  }

  /* ------------------------------------------------ laptop OS */
  get osOpen() {
    return this.os.classList.contains('open');
  }

  /** rect = where the 3D display is on screen; null → full viewport (small screens). */
  showOS(rect: DOMRect | null) {
    const s = this.os.style;
    if (rect) {
      s.left = `${rect.left}px`;
      s.top = `${rect.top}px`;
      s.width = `${rect.width}px`;
      s.height = `${rect.height}px`;
      // UI is laid out for a 1280px-wide screen and scaled to fit the display
      const scale = rect.width / 1280;
      this.os.style.setProperty('--os-scale', String(scale));
      this.os.classList.remove('full');
    } else {
      s.left = s.top = '0';
      s.width = '100vw';
      s.height = '100dvh';
      this.os.style.setProperty('--os-scale', '1');
      this.os.classList.add('full');
    }
    this.os.classList.add('open');
    this.tickClock();
    this.clockTimer = window.setInterval(() => this.tickClock(), 10_000);
    if (rect && !this.desktop.querySelector('.win')) this.openWelcome();
  }
  hideOS() {
    this.os.classList.remove('open');
    clearInterval(this.clockTimer);
  }

  private tickClock() {
    $('#os .os-clock').textContent = new Date().toLocaleString(undefined, {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private buildDesktop() {
    const icons = $('#os .os-icons');
    const add = (icon: string, label: string, open: () => void) => {
      const b = document.createElement('button');
      b.className = 'os-icon';
      b.innerHTML = `<span class="glyph">${icon}</span><span class="label">${esc(label)}</span>`;
      b.addEventListener('click', open);
      icons.append(b);
    };
    const openAbout = () => this.openWindow('about', 'About me', aboutBody(), 'doc');
    add('👤', 'About me', openAbout);
    $('#os [data-open="about"]').addEventListener('click', openAbout);
    $('#os [data-open="terminal"]').addEventListener('click', () => this.openTerminal());
    for (const p of projects) add(p.icon, p.title, () => this.openWindow(p.id, p.title, projectBody(p), 'doc'));
    add('⌨️', 'Terminal', () => this.openTerminal());
  }

  private openWelcome() {
    this.openWindow(
      'welcome',
      'Welcome',
      `<div class="welcome">
        <h1>Hi, I'm ${esc(profile.name)}.</h1>
        <p class="role">${esc(profile.role)}</p>
        <p>${esc(profile.summary)}</p>
        <p class="muted">Open a project from the icons on the left, or try the terminal.<br>Press <kbd>Esc</kbd> to get back to the desk.</p>
      </div>`,
      'doc',
      { w: 620, h: 380, x: 380, y: 140 },
    );
  }

  private openWindow(id: string, title: string, html: string, kind: 'doc' | 'term', geo?: { w: number; h: number; x: number; y: number }) {
    const existing = this.desktop.querySelector<HTMLElement>(`.win[data-id="${id}"]`);
    if (existing) {
      this.focus(existing);
      return existing;
    }
    const n = this.desktop.querySelectorAll('.win').length;
    const g = geo ?? { w: 760, h: 600, x: 230 + n * 34, y: 40 + n * 28 };
    const win = document.createElement('section');
    win.className = `win win-${kind}`;
    win.dataset.id = id;
    Object.assign(win.style, { width: `${g.w}px`, height: `${g.h}px`, left: `${g.x}px`, top: `${g.y}px` });
    win.innerHTML = `
      <div class="win-bar">
        <button class="dot red" aria-label="Close"></button><span class="dot yellow"></span><span class="dot green"></span>
        <span class="win-title">${esc(title)}</span>
      </div>
      <div class="win-body">${html}</div>`;
    win.querySelector('.red')!.addEventListener('click', () => win.remove());
    win.addEventListener('pointerdown', () => this.focus(win));
    this.makeDraggable(win, win.querySelector('.win-bar')!);
    this.desktop.append(win);
    this.focus(win);
    return win;
  }

  private focus(win: HTMLElement) {
    win.style.zIndex = String(++this.zTop);
  }

  private makeDraggable(win: HTMLElement, handle: HTMLElement) {
    handle.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      const scale = parseFloat(getComputedStyle(this.os).getPropertyValue('--os-scale')) || 1;
      const sx = e.clientX, sy = e.clientY;
      const ox = win.offsetLeft, oy = win.offsetTop;
      handle.setPointerCapture(e.pointerId);
      const move = (ev: PointerEvent) => {
        win.style.left = `${ox + (ev.clientX - sx) / scale}px`;
        win.style.top = `${Math.max(0, oy + (ev.clientY - sy) / scale)}px`;
      };
      const up = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
    });
  }

  private openTerminal() {
    const win = this.openWindow('terminal', `${profile.handle.toLowerCase()} — zsh`, `<div class="term"><div class="term-out"></div><label class="term-line"><span class="ps1">~ $</span><input spellcheck="false" autocomplete="off" aria-label="Terminal input"></label></div>`, 'term', {
      w: 640,
      h: 400,
      x: 420,
      y: 220,
    });
    const out = win.querySelector<HTMLElement>('.term-out')!;
    const input = win.querySelector<HTMLInputElement>('input')!;
    if (out.childElementCount) {
      input.focus();
      return;
    }
    const print = (s: string, cls = '') => {
      const d = document.createElement('div');
      if (cls) d.className = cls;
      d.textContent = s;
      out.append(d);
      out.parentElement!.scrollTop = out.parentElement!.scrollHeight;
    };
    const run = (cmd: string) => {
      const [c, ...args] = cmd.trim().split(/\s+/);
      switch (c) {
        case '':
          break;
        case 'help':
          print('whoami · ls · open <project> · skills · contact · clear · exit');
          break;
        case 'whoami':
          print(`${profile.name} — ${profile.role}`);
          print(profile.education);
          break;
        case 'ls':
          projects.forEach((p) => print(`${p.id.padEnd(18)} ${p.tagline}`));
          break;
        case 'open': {
          const p = projects.find((x) => x.id === args[0]);
          if (p) this.openWindow(p.id, p.title, projectBody(p), 'doc');
          else print(`open: no such project: ${args[0] ?? ''} (try ls)`, 'err');
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
          win.remove();
          break;
        case 'sudo':
          print('Nice try. AgentWarden says: deny.', 'err');
          break;
        default:
          print(`zsh: command not found: ${c}`, 'err');
      }
    };
    print('Portfolio OS — type "help" to see commands.', 'muted');
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      print(`~ $ ${input.value}`, 'cmd');
      run(input.value);
      input.value = '';
    });
    win.addEventListener('click', () => input.focus());
    input.focus();
  }
}
