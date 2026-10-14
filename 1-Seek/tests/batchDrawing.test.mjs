import test from 'node:test';
import assert from 'node:assert/strict';
import { scene, Vector, EPS, TARGET_FILES } from './helpers.mjs';

// tableaux imbriqués recopiés dans ce contexte (sinon prototypes d'Array différents)
const plain = value => JSON.parse(JSON.stringify(value));

function load() {
  return scene([...TARGET_FILES, 'mitoticTarget.js', 'burstParticle.js', 'targetBatch.js'],
    ['MitoticTarget', 'BurstParticle', 'TargetBatch']);
}

/* Contexte Canvas 2D factice : enregistre chaque chemin rempli ou tracé
   avec ses formes (arcs, rectangles, polygones) et le style courant. */
function fakeContext() {
  const ctx = { fillStyle: '', strokeStyle: '', globalAlpha: 1, lineWidth: 1, paths: [], saves: 0 };
  let shapes = [];
  let poly = null;
  Object.assign(ctx, {
    save: () => { ctx.saves++; }, restore: () => { ctx.saves--; },
    beginPath: () => { shapes = []; poly = null; },
    moveTo: (x, y) => { poly = [[x, y]]; },
    lineTo: (x, y) => { poly.push([x, y]); },
    closePath: () => { shapes.push({ type: 'poly', points: poly }); poly = null; },
    arc: (x, y, r) => { shapes.push({ type: 'arc', x, y, r }); poly = null; },
    rect: (x, y, w, h) => { shapes.push({ type: 'rect', x, y, w, h }); },
    fill: () => ctx.paths.push({ op: 'fill', style: ctx.fillStyle, alpha: ctx.globalAlpha, shapes }),
    stroke: () => ctx.paths.push({ op: 'stroke', style: ctx.strokeStyle, width: ctx.lineWidth, shapes }),
  });
  return ctx;
}

test('TargetBatch : corps groupés par couleur, avec le flash blanc', () => {
  const { MitoticTarget, TargetBatch } = load();
  const targets = [new MitoticTarget(100, 100), new MitoticTarget(200, 100), new MitoticTarget(300, 100)];
  targets[1].hit();
  const ctx = fakeContext();
  TargetBatch.draw(ctx, targets);
  const bodies = ctx.paths.filter(p => p.op === 'fill' && p.shapes.every(s => s.type === 'arc'));
  assert.deepEqual(bodies.map(p => [p.style, p.shapes.length]), [['red', 2], ['white', 1]]);
  assert.deepEqual(bodies[0].shapes.map(s => [s.x, s.y, s.r]), [[100, 100, 16], [300, 100, 16]]);
  assert.equal(ctx.saves, 0, 'save/restore équilibrés');
  assert.equal(targets[1].color, 'red', 'la couleur d’origine est conservée');
});

test('TargetBatch : barres de vie identiques à healthBar(), fonds puis remplissages par couleur', () => {
  const { MitoticTarget, TargetBatch } = load();
  const targets = [new MitoticTarget(100, 100), new MitoticTarget(200, 100), new MitoticTarget(300, 100)];
  targets[1].hit(); targets[1].hit();
  for (let i = 0; i < 5; i++) targets[2].hit();      // santé nulle : pas de remplissage
  const ctx = fakeContext();
  TargetBatch.draw(ctx, targets);
  const rectPaths = ctx.paths.filter(p => p.shapes.length && p.shapes.every(s => s.type === 'rect'));
  const [background, ...fills] = rectPaths;
  assert.equal(background.shapes.length, 3);
  targets.forEach((t, i) => {
    const b = t.healthBar();
    assert.deepEqual([background.shapes[i].x, background.shapes[i].y, background.shapes[i].w], [b.x - 1, b.y - 1, b.w + 2]);
  });
  const full = targets[0].healthBar(), hurt = targets[1].healthBar();
  const byStyle = Object.fromEntries(fills.map(p => [p.style, p.shapes]));
  assert.deepEqual(byStyle[`rgb(${targets[0].healthColor(1).join(', ')})`].map(s => s.w), [full.fillWidth]);
  assert.ok(Math.abs(byStyle[`rgb(${targets[1].healthColor(0.6).join(', ')})`][0].w - hurt.w * 0.6) < EPS);
  assert.equal(fills.reduce((n, p) => n + p.shapes.length, 0), 2, 'aucun rectangle de largeur nulle');
});

test('TargetBatch : vision seulement en debug ; pont seulement pour une mère en bourgeonnement', () => {
  const { MitoticTarget, TargetBatch } = load();
  const mother = new MitoticTarget(400, 300);
  const daughter = mother.divide(() => 0);
  daughter.pos.set(410, 300);
  const loner = new MitoticTarget(100, 100);
  let ctx = fakeContext();
  TargetBatch.draw(ctx, [mother, daughter, loner]);
  assert.equal(ctx.paths.filter(p => p.op === 'stroke').length, 0, 'pas de vision hors debug');
  const necks = ctx.paths.filter(p => p.shapes.some(s => s.type === 'poly'));
  assert.equal(necks.length, 1);
  assert.equal(necks[0].shapes.length, 1);
  assert.deepEqual(plain(necks[0].shapes[0].points), plain(mother.neckQuad()));

  loner.debug = true;
  ctx = fakeContext();
  TargetBatch.draw(ctx, [mother, daughter, loner]);
  const visions = ctx.paths.filter(p => p.op === 'stroke');
  assert.equal(visions.length, 1);
  assert.deepEqual(visions[0].shapes.map(s => s.r), [loner.rayonDetection]);
  assert.equal(visions[0].width, 1);
});

test('neckQuad : partagé par drawNeck, null sans bourgeonnement ou pour la fille', () => {
  const { MitoticTarget, calls } = load();
  const mother = new MitoticTarget(400, 300);
  assert.equal(mother.neckQuad(), null);
  const daughter = mother.divide(() => 0);
  daughter.pos.set(420, 300);
  assert.equal(daughter.neckQuad(), null);
  const q = mother.neckQuad();
  mother.drawNeck();
  const [quad] = calls.filter(c => c[0] === 'quad');
  assert.deepEqual(plain(quad.slice(1)), plain(q.flat()));
});

test('BurstParticle.drawAll : un chemin par couleur et palier d’opacité, fragments éteints ignorés', () => {
  const { BurstParticle } = load();
  const parts = BurstParticle.explode(new Vector(50, 50), 'red', 6, () => 0.5);
  parts.push(...BurstParticle.explode(new Vector(90, 50), 'white', 3, () => 0.5));
  parts[1].life = BurstParticle.LIFESPAN / 2;   // palier 4/8
  parts[2].life = 0;                            // éteint : ignoré
  const ctx = fakeContext();
  BurstParticle.drawAll(ctx, parts);
  const summary = ctx.paths.map(p => [p.style, p.alpha, p.shapes.length]);
  assert.deepEqual(summary, [['red', 1, 4], ['red', 0.5, 1], ['white', 1, 3]]);
  const half = ctx.paths[1].shapes[0];
  assert.ok(Math.abs(half.r - parts[1].appearance().radius) < EPS);
  assert.equal(ctx.saves, 0);
});

test('appearance : opacité et rayon décroissent avec l’âge', () => {
  const { BurstParticle } = load();
  const [p] = BurstParticle.explode(new Vector(0, 0), 'red', 1, () => 0.5);
  const fresh = p.appearance();
  assert.deepEqual([fresh.alpha, fresh.radius], [1, 4]);
  p.life = 0;
  assert.deepEqual([p.appearance().alpha, p.appearance().radius], [0, 2]);
});
