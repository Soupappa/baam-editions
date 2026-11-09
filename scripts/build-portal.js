'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_FILE = path.join(ROOT, 'portal.config.json');
const PUBLIC = path.join(ROOT, 'public');
const PUBLIC_DATA = path.join(PUBLIC, 'data');
const CHECK_ONLY = process.argv.includes('--check');
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STATUSES = new Set(['public', 'preview']);
const TYPES = new Set(['roman', 'roman-feuilleton', 'essai', 'récit', 'poésie', 'livre-objet']);
const RELATIONS = Object.freeze({
  'part-of': 'contains',
  'derived-from': 'source-of',
  'inspired-by': 'inspires',
  documents: 'documented-by',
  demonstrates: 'demonstrated-by',
  uses: 'used-by',
  'links-to': 'linked-from',
  extends: 'extended-by',
  'related-to': 'related-to'
});

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function stable(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function atomicWrite(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, content, 'utf8');
  fs.renameSync(temporary, file);
}

async function loadManifest(source) {
  const localFile = source.file ? path.resolve(ROOT, source.file) : null;
  const cacheFile = path.resolve(ROOT, source.cache);
  if (localFile && fs.existsSync(localFile)) {
    const manifest = readJson(localFile);
    if (!CHECK_ONLY) atomicWrite(cacheFile, stable(manifest));
    return { manifest, origin: 'file' };
  }
  if (source.url) {
    try {
      const response = await fetch(source.url, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const manifest = await response.json();
      if (!CHECK_ONLY) atomicWrite(cacheFile, stable(manifest));
      return { manifest, origin: 'remote' };
    } catch (error) {
      if (!fs.existsSync(cacheFile)) throw new Error(`${source.id}: source distante indisponible (${error.message}) et cache introuvable`);
    }
  }
  if (!fs.existsSync(cacheFile)) throw new Error(`${source.id}: source et cache introuvables`);
  return { manifest: readJson(cacheFile), origin: 'cache' };
}

function validate(config, records) {
  const errors = [];
  const fail = (where, message) => errors.push(`${where}: ${message}`);
  const territory = config.territory;
  if (config.schemaVersion !== 1) fail('config', 'schemaVersion 1 requis');
  if (!ID.test(territory?.id || '')) fail('territory.id', 'identifiant invalide');
  if (!territory?.name || !territory?.url || !territory?.accent) fail('territory', 'name, url et accent requis');
  const ids = new Set();

  records.forEach(({ manifest }, index) => {
    const at = `sources[${index}]`;
    if (manifest.schemaVersion !== 1) fail(at, 'schemaVersion 1 requis');
    if (!ID.test(manifest.id || '')) fail(`${at}.id`, 'identifiant invalide');
    if (ids.has(manifest.id)) fail(`${at}.id`, 'identifiant dupliqué');
    ids.add(manifest.id);
    if (manifest.id !== config.sources[index].id) fail(`${at}.id`, 'diffère de la source déclarée');
    if (!manifest.title || !manifest.summary || !TYPES.has(manifest.type)) fail(at, 'title, summary et type éditorial valide requis');
    if (!STATUSES.has(manifest.status)) fail(`${at}.status`, 'public ou preview attendu');
    if (!Array.isArray(manifest.territories) || !manifest.territories.includes(territory.id)) fail(`${at}.territories`, `doit contenir ${territory.id}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(manifest.updatedAt || '')) fail(`${at}.updatedAt`, 'date YYYY-MM-DD requise');
    if (!manifest.preview?.url || !manifest.preview?.alt) fail(`${at}.preview`, 'image et texte alternatif requis');
    if (!manifest.presentation?.author || !manifest.presentation?.index) fail(`${at}.presentation`, 'auteur et index requis');
    if (!Array.isArray(manifest.actions) || manifest.actions.length < 1) fail(`${at}.actions`, 'au moins une action requise');
    (manifest.relations || []).forEach((relation, relationIndex) => {
      if (!Object.hasOwn(RELATIONS, relation.type)) fail(`${at}.relations[${relationIndex}]`, `verbe interdit : ${relation.type}`);
      if (!relation.targetId) fail(`${at}.relations[${relationIndex}]`, 'targetId requis');
    });
  });

  records.forEach(({ manifest }, index) => {
    (manifest.relations || []).forEach((relation, relationIndex) => {
      if (!ids.has(relation.targetId)) fail(`sources[${index}].relations[${relationIndex}]`, `cible absente du registre Éditions : ${relation.targetId}`);
    });
  });
  return errors;
}

function compile(config, records) {
  const byId = new Map();
  const assets = records.map(({ manifest, origin }) => {
    const asset = {
      id: manifest.id,
      title: manifest.title,
      summary: manifest.summary,
      type: manifest.type,
      status: manifest.status,
      territories: manifest.territories,
      url: manifest.url || null,
      localUrl: manifest.localUrl || null,
      repository: manifest.repository || null,
      updatedAt: manifest.updatedAt,
      tags: manifest.tags || [],
      preview: manifest.preview,
      presentation: manifest.presentation,
      actions: manifest.actions || [],
      sourceOrigin: origin,
      relations: []
    };
    byId.set(asset.id, asset);
    return asset;
  });

  records.forEach(({ manifest }) => {
    const owner = byId.get(manifest.id);
    (manifest.relations || []).forEach((relation) => {
      owner.relations.push({ type: relation.type, target: relation.targetId, generated: false });
      byId.get(relation.targetId).relations.push({ type: RELATIONS[relation.type], target: manifest.id, generated: true });
    });
  });

  const featured = new Map((config.featured || []).map((id, index) => [id, index]));
  assets.sort((a, b) => {
    const aPin = featured.has(a.id) ? featured.get(a.id) : Number.MAX_SAFE_INTEGER;
    const bPin = featured.has(b.id) ? featured.get(b.id) : Number.MAX_SAFE_INTEGER;
    return aPin - bPin || b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);
  });

  const sourceHash = crypto.createHash('sha256').update(stable({ config, manifests: records.map((record) => record.manifest) })).digest('hex');
  const registry = {
    meta: {
      schemaVersion: 1,
      territory: config.territory.id,
      sourceHash,
      compiledAt: assets.reduce((latest, asset) => asset.updatedAt > latest ? asset.updatedAt : latest, '1970-01-01'),
      count: assets.length,
      relationVocabulary: Object.keys(RELATIONS)
    },
    territory: config.territory,
    assets
  };
  const canonical = (asset) => asset.url || `${config.territory.url}#${asset.id}`;
  const graph = {
    '@context': { '@vocab': 'https://schema.org/', baam: 'https://baam.pro/vocab/' },
    '@graph': [
      {
        '@id': config.territory.url,
        '@type': 'CollectionPage',
        name: `BAAM.${config.territory.name}`,
        description: config.territory.description,
        hasPart: assets.map((asset) => ({ '@id': canonical(asset) }))
      },
      ...assets.map((asset) => ({
        '@id': canonical(asset),
        '@type': 'Book',
        name: asset.title,
        author: { '@type': 'Person', name: asset.presentation.author },
        description: asset.summary,
        dateModified: asset.updatedAt,
        isPartOf: { '@id': config.territory.url }
      }))
    ]
  };
  const sitemapUrls = [config.territory.url, ...assets.map((asset) => asset.url).filter(Boolean)];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls.map((url) => `  <url><loc>${url.replace(/&/g, '&amp;')}</loc></url>`).join('\n')}\n</urlset>\n`;
  const portalManifest = {
    schemaVersion: 1,
    id: 'baam-editions',
    title: 'BAAM.ÉDITIONS',
    summary: config.territory.description,
    type: 'territory',
    status: 'public',
    territories: ['editions'],
    url: config.territory.url,
    updatedAt: registry.meta.compiledAt,
    tags: ['livres', 'édition', 'feuilletons'],
    preview: { type: 'none', key: 'bibliotheque-horizons' },
    relations: []
  };
  return { registry, graph, sitemap, portalManifest };
}

async function main() {
  try {
    const config = readJson(CONFIG_FILE);
    const records = await Promise.all(config.sources.map(loadManifest));
    const errors = validate(config, records);
    if (errors.length) {
      console.error(`Portail invalide (${errors.length}) :`);
      errors.forEach((error) => console.error(`- ${error}`));
      process.exitCode = 1;
      return;
    }
    const output = compile(config, records);
    if (!CHECK_ONLY) {
      atomicWrite(path.join(PUBLIC_DATA, 'registry.json'), stable(output.registry));
      atomicWrite(path.join(PUBLIC_DATA, 'graph.jsonld'), stable(output.graph));
      atomicWrite(path.join(PUBLIC, 'sitemap.xml'), output.sitemap);
      atomicWrite(path.join(PUBLIC, '.well-known', 'baam.json'), stable(output.portalManifest));
    }
    console.log(`${CHECK_ONLY ? 'Validation' : 'Compilation'} Éditions réussie : ${output.registry.meta.count} livre(s), hash ${output.registry.meta.sourceHash.slice(0, 12)}.`);
    records.forEach((record) => console.log(`- ${record.manifest.id}: ${record.origin}`));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

main();
