const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const htmlPath = path.join(rootDir, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

function stripQuery(assetPath) {
  return assetPath.split(/[?#]/, 1)[0];
}

function resolveAsset(assetPath) {
  return path.join(rootDir, stripQuery(assetPath));
}

const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
for (const [index, match] of inlineScripts.entries()) {
  new Function(match[1]);
  console.log(`inline script ${index} ok`);
}

const scriptRefs = [...html.matchAll(/<script[^>]+\bsrc=["']([^"']+)["'][^>]*><\/script>/gi)]
  .map(match => match[1])
  .filter(src => !/^https?:\/\//i.test(src));

for (const src of scriptRefs) {
  const assetPath = resolveAsset(src);
  if (!fs.existsSync(assetPath)) {
    throw new Error(`missing script asset: ${src}`);
  }
  if (stripQuery(src).startsWith('assets/vendor/')) {
    console.log(`script asset ${src} exists`);
    continue;
  }
  new Function(fs.readFileSync(assetPath, 'utf8'));
  console.log(`script asset ${src} ok`);
}

const stylesheetRefs = [...html.matchAll(/<link[^>]+\brel=["']stylesheet["'][^>]+\bhref=["']([^"']+)["'][^>]*>/gi)]
  .map(match => match[1])
  .filter(href => !/^https?:\/\//i.test(href));

for (const href of stylesheetRefs) {
  const assetPath = resolveAsset(href);
  if (!fs.existsSync(assetPath)) {
    throw new Error(`missing stylesheet asset: ${href}`);
  }
  console.log(`stylesheet asset ${href} exists`);
}
