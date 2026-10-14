import test from 'node:test';
import assert from 'node:assert/strict';
import { scene, TARGET_FILES } from './helpers.mjs';

const load = () => scene([...TARGET_FILES, 'mitoticTarget.js', 'hunter.js', 'settings.js', 'qualityGovernor.js'],
  ['QualityGovernor', 'SceneSettings', 'MitoticTarget']);
// la première mesure après un démarrage ou un changement de niveau est plafonnée au budget :
// il faut donc degradeAfter + 1 images surchargées pour alléger d'un niveau
const feed = (g, ms, frames) => { let changes = 0; for (let i = 0; i < frames; i++) if (g.update(ms)) changes++; return changes; };

test('niveaux : du plus beau au plus léger, fumée puis menaces', () => {
  const { QualityGovernor } = load();
  const levels = QualityGovernor.LEVELS;
  assert.equal(levels[0].smoke, true); assert.equal(levels[0].smokeScale, 1); assert.equal(levels[0].threatCap, Infinity);
  for (let i = 1; i < levels.length; i++) {
    const a = levels[i - 1], b = levels[i];
    assert.ok(b.smokeScale <= a.smokeScale && (!b.smoke || a.smoke) && b.threatCap <= a.threatCap, `niveau ${i} plus léger`);
  }
});

test('dans le budget : pleine qualité conservée', () => {
  const { QualityGovernor } = load();
  const g = new QualityGovernor();
  assert.equal(feed(g, 8, 1000), 0);
  assert.equal(g.current().label, 'pleine');
});

test('au-dessus du budget : un niveau de moins toutes les degradeAfter images, jusqu’au dernier', () => {
  const { QualityGovernor } = load();
  const g = new QualityGovernor({ degradeAfter: 20 });
  feed(g, 30, 20);
  assert.equal(g.level, 0, 'pas avant 21 images');
  feed(g, 30, 1);
  assert.equal(g.level, 1);
  feed(g, 30, 1000);
  assert.equal(g.level, QualityGovernor.LEVELS.length - 1, 'plafonné au niveau le plus léger');
});

test('pics isolés, y compris à la toute première image : ignorés', () => {
  const { QualityGovernor } = load();
  const g = new QualityGovernor();
  for (let i = 0; i < 300; i++) g.update(i % 50 === 0 ? 60 : 8);
  assert.equal(g.level, 0);
});

test('surcharge durable dès le démarrage : allégée rapidement malgré la mesure plafonnée', () => {
  const { QualityGovernor } = load();
  const g = new QualityGovernor({ degradeAfter: 20 });
  feed(g, 60, 21);
  assert.equal(g.level, 1);
});

test('zone morte entre la marge et le budget : aucun changement dans un sens ni dans l’autre', () => {
  const { QualityGovernor } = load();
  const g = new QualityGovernor({ budgetMs: 14, recoverRatio: 0.6 });
  feed(g, 30, 21);
  assert.equal(g.level, 1);
  feed(g, 11, 2000);       // 8,4 ms < 11 ms < 14 ms
  assert.equal(g.level, 1);
});

test('marge retrouvée : remontée après recoverAfter images', () => {
  const { QualityGovernor } = load();
  const g = new QualityGovernor({ degradeAfter: 20, recoverAfter: 120 });
  feed(g, 30, 42);
  assert.equal(g.level, 2);
  feed(g, 4, 119);
  assert.equal(g.level, 2);
  feed(g, 4, 1);
  assert.equal(g.level, 1);
  feed(g, 4, 120);
  assert.equal(g.level, 0);
});

test('anti-oscillation : une rechute rapide double le délai de remontée', () => {
  const { QualityGovernor } = load();
  const g = new QualityGovernor({ degradeAfter: 20, recoverAfter: 120 });
  feed(g, 30, 21);              // niveau 1
  feed(g, 4, 120);              // remonte au niveau 0
  assert.equal(g.level, 0);
  feed(g, 30, 21);              // rechute aussitôt
  assert.equal(g.level, 1);
  assert.equal(g.recoverDelay[0], 240);
  feed(g, 4, 239);
  assert.equal(g.level, 1, 'il faut maintenant 240 images de marge');
  feed(g, 4, 1);
  assert.equal(g.level, 0);
});

test('reset : retour à la pleine qualité et délais d’origine', () => {
  const { QualityGovernor } = load();
  const g = new QualityGovernor();
  feed(g, 30, 200);
  g.reset();
  assert.equal(g.level, 0);
  assert.equal(g.average, null);
  assert.ok(g.recoverDelay.every(d => d === g.recoverAfter));
});

test('applyToTarget : le niveau plafonne les menaces sans changer le réglage', () => {
  const { QualityGovernor, SceneSettings, MitoticTarget } = load();
  const s = { ...SceneSettings.defaults(), maxThreats: 12 };
  const t = new MitoticTarget(0, 0);
  SceneSettings.applyToTarget(t, s, QualityGovernor.LEVELS.at(-1));
  assert.equal(t.maxMenaces, 3);
  SceneSettings.applyToTarget(t, s, QualityGovernor.LEVELS[0]);
  assert.equal(t.maxMenaces, 12);
  SceneSettings.applyToTarget(t, s);
  assert.equal(t.maxMenaces, 12);
  assert.equal(s.maxThreats, 12);
});
