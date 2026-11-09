'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'portal.config.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.resolve(root, config.sources[0].file), 'utf8'));

assert.strictEqual(config.territory.id, 'editions');
assert.strictEqual(config.territory.accent.toUpperCase(), '#FF762E');
assert.strictEqual(config.territory.url, 'https://editions.baam.pro/');
assert.strictEqual(manifest.id, 'utile-et-agreable');
assert.ok(manifest.territories.includes('editions'));
assert.strictEqual(manifest.url, 'https://utile-agreable.editions.baam.pro/');
assert.ok(manifest.presentation.author);
assert.ok(manifest.preview.alt);
assert.ok(manifest.actions.some((action) => action.kind === 'primary'));

console.log('Tests réussis : contrat du territoire et premier livre valides.');
