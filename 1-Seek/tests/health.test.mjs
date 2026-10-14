import test from 'node:test';
import assert from 'node:assert/strict';
import { scene, Vector, EPS, TARGET_FILES } from './helpers.mjs';

function load() {
  return scene([...TARGET_FILES, 'mitoticTarget.js', 'burstParticle.js', 'colony.js', 'settings.js'],
    ['Vehicle', 'MitoticTarget', 'BurstParticle', 'TargetColony', 'SceneSettings', 'population: SeekPopulation']);
}

test('step : signale l’arrivée sur la cible (avant ou après déplacement), sinon false', () => {
  const { Vehicle, population } = load();
  const target = new Vector(400, 300);
  const rng = () => 0.1;
  assert.equal(population.step(new Vehicle(400, 300), target, 800, 600, rng), true, 'déjà sur la cible');
  const incoming = new Vehicle(418, 300); incoming.vel.set(-4, 0);
  assert.equal(population.step(incoming, target, 800, 600, rng), true, 'arrive pendant l’image');
  assert.equal(population.step(new Vehicle(100, 100), target, 800, 600, rng), false);
});

test('santé : chaque coup retire 1/maxHealth, éclatement au 5e coup', () => {
  const { MitoticTarget } = load();
  const t = new MitoticTarget(400, 300);
  assert.equal(t.maxHealth, 5);
  assert.equal(t.healthRatio(), 1);
  for (let i = 1; i <= 4; i++) {
    t.hit();
    assert.ok(Math.abs(t.healthRatio() - (1 - i / 5)) < EPS);
    assert.equal(t.isDead(), false);
  }
  t.hit();
  assert.equal(t.isDead(), true);
  assert.equal(t.healthRatio(), 0);
  t.hit();
  assert.equal(t.healthRatio(), 0, 'jamais négatif');
});

test('santé : changer maxHealth conserve les coups reçus', () => {
  const { MitoticTarget } = load();
  const t = new MitoticTarget(400, 300);
  t.hit(); t.hit(); t.hit();
  t.maxHealth = 10;
  assert.ok(Math.abs(t.healthRatio() - 0.7) < EPS);
  assert.equal(t.isDead(), false);
  t.maxHealth = 3;
  assert.equal(t.isDead(), true, 'abaisser le seuil peut faire éclater');
});

test('coup : flash blanc pendant quelques images, couleur d’origine conservée', () => {
  const { MitoticTarget, calls } = load();
  const t = new MitoticTarget(400, 300);
  t.hit();
  calls.length = 0; t.show();
  assert.ok(calls.some(([n, c]) => n === 'fill' && c === 'white'));
  assert.equal(t.color, 'red');
  for (let i = 0; i < 6; i++) t.update();
  calls.length = 0; t.show();
  assert.ok(!calls.some(([n, c]) => n === 'fill' && c === 'white'));
});

test('barre de vie : toujours dessinée, largeur proportionnelle à la santé', () => {
  const { MitoticTarget, calls } = load();
  const t = new MitoticTarget(400, 300);
  const barWidth = () => {
    calls.length = 0; t.show();
    const rects = calls.filter(c => c[0] === 'rect');
    assert.equal(rects.length, 2, 'fond + remplissage');
    return rects[1][3];
  };
  const full = barWidth();
  assert.equal(full, 32);
  t.hit(); t.hit();
  assert.ok(Math.abs(barWidth() - full * 0.6) < EPS);
});

test('fille : santé neuve mais même maxHealth que la mère', () => {
  const { MitoticTarget } = load();
  const mother = new MitoticTarget(400, 300);
  mother.maxHealth = 8; mother.hit(); mother.hit();
  const daughter = mother.divide(() => 0);
  assert.deepEqual([daughter.maxHealth, daughter.damage], [8, 0]);
  assert.equal(mother.damage, 2);
});

test('colonie : retire les cibles détruites, libère la partenaire, garde au moins une cible', () => {
  const { MitoticTarget, TargetColony } = load();
  const mother = new MitoticTarget(400, 300);
  const daughter = mother.divide(() => 0);
  const other = new MitoticTarget(100, 100);
  const targets = [mother, other, daughter];
  for (let i = 0; i < 5; i++) mother.hit();
  const dead = TargetColony.removeDead(targets);
  assert.deepEqual(dead, [mother]);
  assert.deepEqual(targets, [other, daughter]);
  assert.equal(daughter.bud, null, 'la fille n’attend plus une mère disparue');
  assert.equal(daughter.r, 16);

  for (const t of targets) for (let i = 0; i < 5; i++) t.hit();
  assert.equal(TargetColony.removeDead(targets).length, 2);
  assert.equal(targets.length, 0);
  TargetColony.ensureOne(targets, () => new MitoticTarget(0, 0));
  assert.equal(targets.length, 1);
  TargetColony.ensureOne(targets, () => assert.fail('pas de création si une cible existe'));
});

test('éclatement : fragments répartis tout autour, vers l’extérieur, couleur de la cible', () => {
  const { BurstParticle, Vehicle } = load();
  const parts = BurstParticle.explode(new Vector(200, 100), 'red', 8, () => 0.5);
  assert.equal(parts.length, 8);
  assert.ok(parts.every(p => p instanceof Vehicle && p.color === 'red'));
  assert.ok(parts.every(p => p.pos.x === 200 && p.pos.y === 100));
  assert.ok(parts.every(p => Math.abs(p.vel.mag() - 4) < EPS));
  const sum = parts.reduce((s, p) => s.add(p.vel), new Vector());
  assert.ok(sum.mag() < 1e-9, 'directions régulièrement réparties');
});

test('fragment : traînée opposée à la vitesse et bornée, ralentit puis disparaît', () => {
  const { BurstParticle } = load();
  const [p] = BurstParticle.explode(new Vector(0, 0), 'red', 1, () => 1);
  const drag = p.dragForce();
  assert.ok(drag.x < 0 && Math.abs(drag.y) < EPS);
  assert.ok(drag.mag() <= p.maxForce + EPS);
  p.maxForce = 0.01;
  assert.ok(p.dragForce().mag() <= 0.01 + EPS);
  p.maxForce = 1;
  let previous = p.vel.mag();
  for (let i = 0; i < BurstParticle.LIFESPAN; i++) {
    assert.equal(p.isDead(), false);
    p.update();
    assert.ok(p.vel.mag() < previous); previous = p.vel.mag();
    assert.equal(p.acc.mag(), 0);
  }
  assert.equal(p.isDead(), true);
  assert.ok(p.pos.x > 0, 'projeté vers l’extérieur');
});

test('réglage targetHealth appliqué aux cibles', () => {
  const { MitoticTarget, SceneSettings } = load();
  const t = new MitoticTarget(0, 0);
  SceneSettings.applyToTarget(t, { ...SceneSettings.defaults(), targetHealth: 12 });
  assert.equal(t.maxHealth, 12);
});
