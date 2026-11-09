'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const index = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
const styles = fs.readFileSync(path.join(publicDir, 'styles.css'), 'utf8');
const app = fs.readFileSync(path.join(publicDir, 'app.js'), 'utf8');
const registry = JSON.parse(fs.readFileSync(path.join(publicDir, 'data', 'registry.json'), 'utf8'));
const graph = JSON.parse(fs.readFileSync(path.join(publicDir, 'data', 'graph.jsonld'), 'utf8'));

assert.match(index, /baam-signe univers="editions"/);
assert.match(index, /id="bibliotheque"/);
assert.match(styles, /prefers-reduced-motion/);
assert.match(styles, /--editions:\s*#FF762E/i);
assert.match(app, /pointermove/);
assert.match(app, /requestAnimationFrame/);
assert.strictEqual(registry.meta.count, 1);
assert.strictEqual(registry.assets[0].id, 'utile-et-agreable');
assert.ok(graph['@graph'].some((node) => node['@type'] === 'Book'));
assert.ok(fs.existsSync(path.join(publicDir, '.well-known', 'baam.json')));

console.log('Tests réussis : sorties publiques, card et exports machine cohérents.');
