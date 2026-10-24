// `npm run site`: the presentation site, in _site/ (what GitHub Pages serves, see .github/workflows/pages.yml).
// site/index.html gets the latest release's download links; docs/ and CHANGELOG.md become HTML pages in the
// site/page.html template; the web editor, already built under BASE_PATH=/plume/app, is copied to app/.
// Every link between pages is relative, so the site works wherever it is served.
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { Marked } from 'marked';

const OUT = '_site';
const REPO = 'stakovicz/plume';
const RELEASES = `https://github.com/${REPO}/releases/latest`;
const SITE = 'https://stakovicz.github.io/plume/';
const DESCRIPTION = 'Éditeur vectoriel simple, léger, libre et gratuit, pour macOS, Linux et le navigateur. Sans compte, sans abonnement.';

/** schema.org description of the app for search engines (JSON-LD), the release's version and date when known.
 *  `<` escaped so nothing in it can close the <script> element. */
function softwareJSON(release) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Plume',
    description: DESCRIPTION,
    url: SITE,
    applicationCategory: 'DesignApplication',
    operatingSystem: 'macOS, Linux, Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    license: 'https://opensource.org/licenses/MIT',
    author: { '@type': 'Person', name: 'Stakovicz', url: `https://github.com/${REPO.split('/')[0]}` },
    inLanguage: 'fr',
    image: `${SITE}img/icon.svg`,
    screenshot: `${SITE}img/editeur.webp`,
    softwareHelp: { '@type': 'CreativeWork', url: `${SITE}docs/` },
    releaseNotes: `${SITE}changelog.html`,
    ...(release && { softwareVersion: release.tag_name.replace(/^v/, ''), datePublished: release.published_at.slice(0, 10), downloadUrl: release.html_url }),
  };
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/** GitHub's heading anchors (`## Import SVG` → `#import-svg`), so links written for GitHub keep working. */
const slug = (html) => html.replace(/<[^>]+>/g, '').replace(/&#?\w+;/g, '').toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-');
const marked = new Marked({
  renderer: {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      return `<h${depth} id="${slug(text)}">${text}</h${depth}>\n`;
    },
  },
});

/** Links to Markdown pages point to their HTML (a folder's README.md is its index.html). */
const htmlLinks = (html) => html.replace(/href="([^":#]*?)(README)?\.md(#[^"]*)?"/g, (_, path, readme, hash = '') => `href="${path}${readme ? 'index' : ''}.html${hash}"`);

/** Links to GitHub open in a new tab (the site stays open), except file downloads, which would leave an empty one. */
const githubInNewTab = (html) => html.replace(/<a ([^>]*?)href="(https:\/\/github\.com\/[^"]*)"([^>]*)>(.*?)<\/a>/gs,
  (a, before, url, after, text) => (url.includes('/releases/download/') ? a
    : `<a ${before}href="${url}"${after} target="_blank" rel="noopener">${text}<span class="visually-hidden"> (nouvel onglet)</span></a>`));

const template = readFileSync('site/page.html', 'utf8');
const fill = (s, values) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => {
  if (!(k in values)) throw new Error(`no value for {{${k}}}`);
  return values[k];
});

const escapeAttr = (t) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** A page's summary for search engines, link previews and llms.txt: the paragraph right after its title, as plain
 *  text of ~160 characters ('' when the page starts with something else). */
function summary(markdown) {
  const para = markdown.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)[1] ?? '';
  if (/^[#|!>\-*\d`<]/.test(para)) return '';
  const text = para.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();
  return text.length <= 160 ? text : `${text.slice(0, 157).replace(/\s+\S*$/, '')}…`;
}

/** Every page written, for sitemap.xml and llms.txt: path in _site, title, summary, its Markdown. */
const pages = [];

/** One Markdown file → `out` (relative to _site), in the page template, plus a copy of the Markdown next to it
 *  (`<link rel="alternate">`): plain text that AI assistants read better than HTML. */
function page(source, out, back, about) {
  const html = htmlLinks(marked.parse(readFileSync(source, 'utf8')))
    .replace(/<table>/g, '<div class="table"><table>').replace(/<\/table>/g, '</table></div>'); // see .doc .table
  const root = relative(dirname(join(OUT, out)), OUT).replace(/\\/g, '/');
  const prefix = root ? `${root}/` : './';
  const markdown = readFileSync(source, 'utf8'), md = out.replace(/\.html$/, '.md');
  const title = markdown.match(/^# (.+)$/m)?.[1].replace(/[*_`]/g, '') ?? 'Plume'; // plain text: escaped where it goes
  const description = about ?? (summary(markdown) || DESCRIPTION);
  pages.push({ path: out, title, description, md });
  mkdirSync(dirname(join(OUT, out)), { recursive: true });
  writeFileSync(join(OUT, md), markdown);
  writeFileSync(join(OUT, out), githubInNewTab(fill(template, {
    title: escapeAttr(title), root: prefix, source, content: html,
    description: escapeAttr(description), shareTitle: escapeAttr(`${title} — Plume`), url: SITE + out.replace(/index\.html$/, ''),
    markdown: md.split('/').pop(),
    back: back ? `<a class="back" href="${prefix}${back.href}">← ${back.text}</a>` : '',
  })));
}

/** The latest release, for the download buttons; null offline or rate-limited (they link to the releases page). */
async function latestRelease() {
  try {
    const headers = process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    console.warn(`latest release: ${e.message}; download buttons link to ${RELEASES}`);
    return null;
  }
}

/** Buttons for the assets matching each pattern; one to the releases page when none matches. Their accessible name
 *  says what and for which system (the visible label alone, « Intel », says neither). */
function buttons(release, platform, kinds) {
  const items = kinds.flatMap(([label, re]) => {
    const asset = release?.assets.find((a) => re.test(a.name));
    const name = `Télécharger Plume ${release?.tag_name ?? ''} pour ${platform}, ${label}`;
    return asset ? [`<li><a class="button primary" href="${asset.browser_download_url}" aria-label="${name}">${label}</a></li>`] : [];
  });
  return `<ul>${items.length ? items.join('') : `<li><a class="button primary" href="${RELEASES}">Voir les fichiers</a></li>`}</ul>`;
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);

const release = await latestRelease();
writeFileSync(join(OUT, 'index.html'), githubInNewTab(fill(readFileSync('site/index.html', 'utf8'), {
  version: release?.tag_name ?? '',
  jsonld: softwareJSON(release),
  mac: buttons(release, 'macOS', [['Apple Silicon', /aarch64\.dmg$/], ['Intel', /x64\.dmg$/]]),
  linux: buttons(release, 'Linux', [['AppImage', /\.AppImage$/], ['Debian, Ubuntu (.deb)', /\.deb$/], ['Fedora (.rpm)', /\.rpm$/]]),
})));
cpSync('site/style.css', join(OUT, 'style.css'));
cpSync('site/img', join(OUT, 'img'), { recursive: true });
cpSync('docs/img', join(OUT, 'docs/img'), { recursive: true }); // images of the docs pages
cpSync('site/fonts', join(OUT, 'fonts'), { recursive: true }); // Fira Sans Bold for titles, as in the app (Latin subset, WOFF2)

const docs = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? docs(join(dir, e.name)) : e.name.endsWith('.md') ? [join(dir, e.name)] : []));
for (const source of docs('docs')) {
  const out = source.replace(/README\.md$/, 'index.html').replace(/\.md$/, '.html');
  page(source, out, out === 'docs/index.html' ? null : { href: 'docs/', text: 'Documentation' });
}
page('CHANGELOG.md', 'changelog.html', { href: '', text: 'Plume' }, 'Les nouveautés et corrections de chaque version de Plume.');

const app = readFileSync('build/index.html', 'utf8');
if (!app.includes('/plume/app/')) throw new Error('build/ is not the web editor for the site: run `npm run site`, which builds it with BASE_PATH=/plume/app');
cpSync('build', join(OUT, 'app'), { recursive: true });
writeFileSync(join(OUT, '.nojekyll'), ''); // serve _app/ as is

// For search engines: every page. ponytail: no robots.txt, a project site can't have one (it lives at the
// domain's root, stakovicz.github.io); submit the sitemap in Search Console instead.
const urls = ['', 'app/', ...pages.map((p) => p.path.replace(/index\.html$/, ''))];
writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}${u}</loc></url>`).join('\n')}
</urlset>
`);

// For AI assistants (llmstxt.org): llms.txt, what Plume is and where each doc page is, in Markdown;
// llms-full.txt, the whole documentation in one text.
const sections = [['tutoriels', 'Tutoriels'], ['guides', 'Guides pratiques'], ['reference', 'Référence'], ['explications', 'Explications']];
const entry = (p) => `- [${p.title}](${SITE}${p.md}): ${p.description}`;
writeFileSync(join(OUT, 'llms.txt'), `# Plume

> ${DESCRIPTION}

Plume dessine en vectoriel (formes, plume, crayon, texte, plans de travail), combine les formes, applique dégradés et
effets, ouvre et exporte le SVG, et exporte en PDF, PNG et JPG. Licence MIT. Application de bureau pour macOS et Linux
(Tauri), version web : ${SITE}app/. Code : https://github.com/${REPO}. Documentation en français.

${sections.map(([dir, name]) => `## ${name}\n\n${pages.filter((p) => p.path.startsWith(`docs/${dir}/`)).map(entry).join('\n')}`).join('\n\n')}

## Optional

${pages.filter((p) => p.path === 'docs/index.html' || p.path === 'changelog.html').map(entry).join('\n')}
- [Toute la documentation en un fichier](${SITE}llms-full.txt)
`);
const ordered = [...sections.flatMap(([dir]) => pages.filter((p) => p.path.startsWith(`docs/${dir}/`))), ...pages.filter((p) => p.path === 'changelog.html')];
writeFileSync(join(OUT, 'llms-full.txt'), `# Plume — documentation complète\n\n> ${DESCRIPTION}\n\n` +
  ordered.map((p) => `<!-- ${SITE}${p.path} -->\n\n${readFileSync(join(OUT, p.md), 'utf8').trim()}`).join('\n\n---\n\n') + '\n');

console.log(`site written to ${OUT}/`);
