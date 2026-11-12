import type { Project } from './data';
import { aboutBody, projectBody } from './content';
import { PortfolioOS } from './os/os';

const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;

export interface UICallbacks {
  onExitLaptop(): void;
  onPanelClosed(): void;
}

export class UI {
  private loader = $('#loader');
  private tooltip = $('#tooltip');
  private panel = $('#panel');
  private sheet = $('#panel .sheet');
  private sheetBody = $('#panel .sheet-body');
  readonly os: PortfolioOS;

  constructor(private cb: UICallbacks) {
    this.os = new PortfolioOS($('#os'), () => cb.onExitLaptop());
    $('#panel .sheet-close').addEventListener('click', () => this.closePanel());
    $('#panel .scrim').addEventListener('click', () => this.closePanel());
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.panelOpen) this.closePanel();
    });
    if (matchMedia('(pointer: coarse)').matches) $('#hint').innerHTML = $('#hint').innerHTML.replaceAll('Click', 'Tap');
  }

  /* ------------------------------------------------ loader & intro */
  setProgress(p: number) {
    $('#loader .bar i').style.width = `${Math.round(p * 100)}%`;
  }
  hideLoader() {
    this.loader.classList.add('done');
    setTimeout(() => this.loader.remove(), 1500);
  }
  showTitle() {
    const t = $('#title');
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3200);
  }
  endIntro() {
    document.body.classList.add('intro-done');
  }

  /* ------------------------------------------------ tooltip & hint */
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
    $('#hint').classList.toggle('show', visible);
  }

  /* ------------------------------------------------ document sheet */
  get panelOpen() {
    return this.panel.classList.contains('open');
  }

  /** rect = the paper on screen; the readable sheet takes its exact place. null → centred sheet. */
  openProject(p: Project, rect: DOMRect | null) {
    this.sheetBody.innerHTML = projectBody(p);
    this.openSheet(rect);
  }
  openAbout(rect: DOMRect | null) {
    this.sheetBody.innerHTML = aboutBody();
    this.openSheet(rect);
  }

  private openSheet(rect: DOMRect | null) {
    const r = rect ?? this.centredRect();
    Object.assign(this.sheet.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    this.sheet.scrollTop = 0;
    this.panel.classList.add('open');
    $<HTMLButtonElement>('#panel .sheet-close').focus({ preventScroll: true });
  }

  /** Re-align the sheet after a resize. */
  placeSheet(r: DOMRect) {
    Object.assign(this.sheet.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  }

  private centredRect() {
    const w = Math.min(680, innerWidth - 32);
    const h = Math.min(innerHeight * 0.86, 900);
    return new DOMRect((innerWidth - w) / 2, (innerHeight - h) / 2, w, h);
  }

  closePanel() {
    if (!this.panelOpen) return;
    this.panel.classList.remove('open');
    this.cb.onPanelClosed();
  }

  /* ------------------------------------------------ laptop OS */
  get osOpen() {
    return this.os.isOpen;
  }
  showOS(rect: DOMRect | null) {
    this.os.show(rect);
  }
  hideOS() {
    this.os.hide();
  }
}
