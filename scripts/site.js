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

/** schema.org description of the app for search engines (JSON-LD), the release's version and date when known.
 *  `<` escaped so nothing in it can close the <script> element. */
function softwareJSON(release) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Plume',
    description: 'Éditeur vectoriel simple, léger, libre et gratuit, pour macOS, Linux et le navigateur. Sans compte, sans abonnement.',
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
const slug = (html) => html.replace(/<[^>]+>/g, '').toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-');
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

/** One Markdown file → `out` (relative to _site), in the page template. */
function page(source, out, back) {
  const html = htmlLinks(marked.parse(readFileSync(source, 'utf8')))
    .replace(/<table>/g, '<div class="table"><table>').replace(/<\/table>/g, '</table></div>'); // see .doc .table
  const root = relative(dirname(join(OUT, out)), OUT).replace(/\\/g, '/');
  const prefix = root ? `${root}/` : './';
  const title = html.match(/<h1[^>]*>(.*?)<\/h1>/)?.[1].replace(/<[^>]+>/g, '') ?? 'Plume';
  mkdirSync(dirname(join(OUT, out)), { recursive: true });
  writeFileSync(join(OUT, out), githubInNewTab(fill(template, {
    title, root: prefix, source, content: html,
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
page('CHANGELOG.md', 'changelog.html', { href: '', text: 'Plume' });

const app = readFileSync('build/index.html', 'utf8');
if (!app.includes('/plume/app/')) throw new Error('build/ is not the web editor for the site: run `npm run site`, which builds it with BASE_PATH=/plume/app');
cpSync('build', join(OUT, 'app'), { recursive: true });
writeFileSync(join(OUT, '.nojekyll'), ''); // serve _app/ as is

console.log(`site written to ${OUT}/`);
