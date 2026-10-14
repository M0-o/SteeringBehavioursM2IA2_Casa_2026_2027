import test from 'node:test';
import assert from 'node:assert/strict';
import { scene, EPS, TARGET_FILES } from './helpers.mjs';

function load() {
  return scene([...TARGET_FILES, 'mitoticTarget.js', 'colony.js'],
    ['Vehicle', 'EvadingTarget', 'MitoticTarget', 'TargetColony']);
}

test('readyToDivide : seulement après divisionDelay images et hors bourgeonnement', () => {
  const { MitoticTarget, EvadingTarget } = load();
  const t = new MitoticTarget(400, 300);
  assert.ok(t instanceof EvadingTarget);
  t.divisionDelay = 5;
  for (let i = 0; i < 4; i++) { t.tick(); assert.equal(t.readyToDivide(), false); }
  t.tick();
  assert.equal(t.readyToDivide(), true);
  t.divide(() => 0);
  t.age = 999;
  assert.equal(t.readyToDivide(), false, 'pas de division pendant un bourgeonnement');
});

test('divide : fille petite, collée sur l’axe perpendiculaire à la vitesse, liée, réglages copiés', () => {
  const { MitoticTarget } = load();
  const mother = new MitoticTarget(400, 300);
  mother.vel.set(2, 0);
  Object.assign(mother, { rayonDetection: 150, vitesseFuiteMax: 9, threatMode: 'flee',
    calmMode: 'wander', debug: true, divisionDelay: 77, age: 77, maxMenaces: 4 });
  const daughter = mother.divide(() => 0);

  assert.ok(daughter instanceof MitoticTarget);
  assert.ok(Math.abs(daughter.pos.x - 400) < EPS && Math.abs(daughter.pos.y - 300.5) < EPS);
  assert.ok(Math.abs(daughter.r - 16 * MitoticTarget.BUD_START_SCALE) < EPS);
  assert.deepEqual([daughter.vel.x, daughter.vel.y], [2, 0]);
  assert.notEqual(daughter.vel, mother.vel, 'vitesse copiée, pas partagée');
  assert.deepEqual([daughter.rayonDetection, daughter.vitesseFuiteMax, daughter.threatMode,
    daughter.calmMode, daughter.debug, daughter.divisionDelay, daughter.maxMenaces],
  [150, 9, 'flee', 'wander', true, 77, 4]);
  assert.equal(mother.bud.partner, daughter); assert.equal(mother.bud.isParent, true);
  assert.equal(daughter.bud.partner, mother); assert.equal(daughter.bud.isParent, false);
  assert.deepEqual([mother.age, daughter.age], [0, 0]);
});

test('divide à l’arrêt : axe tiré par le rng injecté', () => {
  const { MitoticTarget } = load();
  const mother = new MitoticTarget(400, 300);
  const daughter = mother.divide(() => 0);          // angle 0 -> axe +x
  assert.ok(Math.abs(daughter.pos.x - 400.5) < EPS && Math.abs(daughter.pos.y - 300) < EPS);
});

test('séparation : poussées opposées, le long de l’axe, bornées par maxForce', () => {
  const { MitoticTarget } = load();
  const mother = new MitoticTarget(400, 300);
  const daughter = mother.divide(() => 0);
  const a = mother.budSeparation(), b = daughter.budSeparation();
  assert.ok(a.x < 0 && b.x > 0);
  assert.ok(Math.abs(a.mag() - mother.maxForce * mother.budPush) < EPS);
  const total = mother.behaviors([], null);
  assert.ok(total.mag() <= mother.maxForce + EPS);
  mother.budPush = 5;
  assert.ok(mother.behaviors([], null).mag() <= mother.maxForce + EPS);
});

test('bourgeonnement : la fille grossit en s’éloignant puis les cellules se détachent', () => {
  const { MitoticTarget } = load();
  const mother = new MitoticTarget(400, 300);
  const daughter = mother.divide(() => 0);
  let previousR = daughter.r, frames = 0;
  while (mother.bud && frames < 500) {
    for (const cell of [mother, daughter]) cell.tick();
    for (const cell of [mother, daughter]) {
      cell.applyForce(cell.behaviors([], null));
      cell.update();
    }
    if (daughter.bud) { assert.ok(daughter.r >= previousR - EPS); previousR = daughter.r; }
    assert.equal(mother.r, 16, 'la mère garde sa taille');
    frames++;
  }
  assert.equal(mother.bud, null); assert.equal(daughter.bud, null);
  assert.equal(daughter.r, 16);
  assert.ok(frames < MitoticTarget.BUD_MAX_FRAMES, `séparées par les forces en ${frames} images`);
  assert.ok(mother.pos.dist(daughter.pos) >= mother.separationDistance() - 1);
});

test('bourgeonnement bloqué : détachement forcé après BUD_MAX_FRAMES', () => {
  const { MitoticTarget } = load();
  const mother = new MitoticTarget(400, 300);
  const daughter = mother.divide(() => 0);
  for (let i = 0; i < MitoticTarget.BUD_MAX_FRAMES; i++) { mother.tick(); daughter.tick(); }
  assert.equal(mother.bud, null); assert.equal(daughter.bud, null);
  assert.equal(daughter.r, 16);
});

test('show : pont entre mère et fille dessiné par la mère seulement, aminci avec la séparation', () => {
  const { MitoticTarget, calls } = load();
  const mother = new MitoticTarget(400, 300);
  const daughter = mother.divide(() => 0);
  daughter.show();
  assert.equal(calls.filter(c => c[0] === 'quad').length, 0);
  mother.show();
  const [quad] = calls.filter(c => c[0] === 'quad');
  const width = Math.abs(quad[2] - quad[8]);
  assert.ok(width > 0);
  daughter.pos.set(400 + mother.separationDistance(), 300);
  calls.length = 0; mother.show();
  const [thin] = calls.filter(c => c[0] === 'quad');
  assert.ok(Math.abs(thin[2] - thin[8]) < EPS, 'pont de largeur nulle au détachement');
});

test('colonie : divisions limitées par maxTargets, filles ajoutées, reset à une cible', () => {
  const { MitoticTarget, TargetColony } = load();
  const targets = [new MitoticTarget(100, 100), new MitoticTarget(300, 300), new MitoticTarget(500, 500)];
  for (const t of targets) t.divisionDelay = 1;
  const born = TargetColony.step(targets, 4, () => 0);
  assert.equal(born.length, 1);
  assert.equal(targets.length, 4);
  assert.equal(targets[3], born[0]);
  assert.equal(TargetColony.step(targets, 4, () => 0).length, 0, 'plafond atteint');

  TargetColony.reset(targets, () => new MitoticTarget(0, 0));
  assert.equal(targets.length, 1);
  assert.equal(targets[0].age, 0);
});
