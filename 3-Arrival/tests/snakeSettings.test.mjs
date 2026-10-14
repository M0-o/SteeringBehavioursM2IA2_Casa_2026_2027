import test from 'node:test';
import assert from 'node:assert/strict';
import { scene, seeded } from './helpers.mjs';

const load = () => scene(['snakeSettings.js'], [
  'SNAKE_SLIDERS', 'SNAKE_MODES', 'SNAKE_PATTERNS',
  'defaultSnakeSettings', 'clampSnakeSettings', 'randomSnakeSettings',
]);

const inBounds = (SNAKE_SLIDERS, s) =>
  Object.entries(SNAKE_SLIDERS).every(([k, spec]) => s[k] >= spec.min && s[k] <= spec.max);

test('valeurs par défaut : dans les bornes, suivi de la souris', () => {
  const { SNAKE_SLIDERS, defaultSnakeSettings } = load();
  const s = defaultSnakeSettings();
  assert.ok(inBounds(SNAKE_SLIDERS, s));
  assert.equal(s.mode, 'mouse');
  assert.match(s.color, /^#[0-9a-f]{6}$/i);
  for (const spec of Object.values(SNAKE_SLIDERS)) assert.ok(spec.min <= spec.value && spec.value <= spec.max);
});

test('clamp : bornes min/max, longueur entière, valeurs invalides remplacées', () => {
  const { SNAKE_SLIDERS, clampSnakeSettings, defaultSnakeSettings } = load();
  const s = clampSnakeSettings({
    maxSpeed: 999, maxForce: -4, length: 12.6, headSize: 'abc',
    mode: 'teleport', pattern: 'plaid', color: 'red', color2: '#123456', name: '  Kaa  ',
  });
  assert.equal(s.maxSpeed, SNAKE_SLIDERS.maxSpeed.max);
  assert.equal(s.maxForce, SNAKE_SLIDERS.maxForce.min);
  assert.equal(s.length, 13);
  assert.equal(s.headSize, SNAKE_SLIDERS.headSize.value);
  const d = defaultSnakeSettings();
  assert.deepEqual([s.mode, s.pattern, s.color], [d.mode, d.pattern, d.color]);
  assert.equal(s.color2, '#123456');
  assert.equal(s.name, 'Kaa');
});

test('clamp : les modes et motifs connus sont conservés', () => {
  const { clampSnakeSettings, SNAKE_MODES, SNAKE_PATTERNS } = load();
  for (const mode of Object.keys(SNAKE_MODES)) assert.equal(clampSnakeSettings({ mode }).mode, mode);
  for (const pattern of Object.keys(SNAKE_PATTERNS)) assert.equal(clampSnakeSettings({ pattern }).pattern, pattern);
});

test('aléatoire : reproductible avec un rng fixé, toujours dans les bornes', () => {
  const { SNAKE_SLIDERS, randomSnakeSettings } = load();
  assert.deepEqual(randomSnakeSettings(seeded(7)), randomSnakeSettings(seeded(7)));
  const rng = seeded(42);
  for (let i = 0; i < 200; i++) {
    const s = randomSnakeSettings(rng);
    assert.ok(inBounds(SNAKE_SLIDERS, s), JSON.stringify(s));
    assert.match(s.color, /^#[0-9a-f]{6}$/);
    assert.match(s.color2, /^#[0-9a-f]{6}$/);
  }
  // rng aux extrêmes de [0, 1[
  assert.ok(inBounds(SNAKE_SLIDERS, randomSnakeSettings(() => 0)));
  assert.ok(inBounds(SNAKE_SLIDERS, randomSnakeSettings(() => 0.999999)));
});
