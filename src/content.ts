import { profile, type Project } from './data';

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Project write-up, shared by the paper sheet on the desk and the README viewer in the laptop. */
export function projectBody(p: Project) {
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

export function aboutBody() {
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
