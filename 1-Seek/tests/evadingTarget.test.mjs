import test from 'node:test';
import assert from 'node:assert/strict';
import { scene, Vector, EPS, TARGET_FILES } from './helpers.mjs';

function setup() {
  const loaded = scene(TARGET_FILES, ['Vehicle', 'Target', 'EvadingTarget']);
  return { ...loaded, target: new loaded.EvadingTarget(400, 300) };
}

test('EvadingTarget hérite de Target sans son mouvement erratique', () => {
  const { Target, target } = setup();
  assert.ok(target instanceof Target);
  assert.equal(target.erratic, false);
  assert.deepEqual([target.vel.x, target.vel.y, target.r], [0, 0, 16]);
  for (let i = 0; i < 120; i++) target.update();
  assert.deepEqual([target.pos.x, target.pos.y, target.r, target.color], [400, 300, 16, 'red']);
});

test('vitesseSelonDistance : max au contact, calme au bord et au-delà, décroissante', () => {
  const { target } = setup();
  assert.equal(target.vitesseSelonDistance(0), target.vitesseFuiteMax);
  assert.equal(target.vitesseSelonDistance(100), target.vitesseCalme);
  assert.equal(target.vitesseSelonDistance(400), target.vitesseCalme);
  assert.ok(Math.abs(target.vitesseSelonDistance(50) - 4) < EPS);
  let previous = Infinity;
  for (let d = 0; d <= 100; d += 5) {
    const v = target.vitesseSelonDistance(d);
    assert.ok(v <= previous); previous = v;
  }
});

test('menacesProches : rayon strict, tri par distance, exclut la cible ; rayon réglable', () => {
  const { Vehicle, target } = setup();
  const far = new Vehicle(550, 300), edge = new Vehicle(500, 300);
  const near = new Vehicle(420, 300), mid = new Vehicle(400, 360);
  // tableaux recopiés dans ce contexte (sinon prototypes d'Array différents)
  const vehiclesOf = menaces => Array.from(menaces, m => m.vehicle);
  let menaces = target.menacesProches([far, edge, mid, near, target]);
  assert.deepEqual(vehiclesOf(menaces), [near, mid]);
  assert.deepEqual(Array.from(menaces, m => m.distance), [20, 60]);
  target.rayonDetection = 30;
  menaces = target.menacesProches([far, edge, mid, near]);
  assert.deepEqual(vehiclesOf(menaces), [near]);
});

test('menacesProches : seules les maxMenaces plus proches sont retenues', () => {
  const { Vehicle, target } = setup();
  // 20 véhicules à 5, 10, ..., 100 px (le dernier hors du rayon strict)
  const vehicles = Array.from({ length: 20 }, (_, i) => new Vehicle(400 + (20 - i) * 5, 300));
  assert.equal(target.maxMenaces, 8);
  const menaces = target.menacesProches(vehicles);
  assert.deepEqual(Array.from(menaces, m => m.distance), [5, 10, 15, 20, 25, 30, 35, 40]);
  target.maxMenaces = 1;
  assert.deepEqual(Array.from(target.menacesProches(vehicles), m => m.distance), [5]);
  target.maxMenaces = 100;
  assert.equal(target.menacesProches(vehicles).length, 19);
});

test('menacesProches : mêmes k plus proches que le tri complet, quel que soit l’ordre des candidats', () => {
  const { Vehicle, target } = setup();
  let seed = 5;
  const rng = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  for (const k of [1, 3, 8, 32, 1000]) {
    target.maxMenaces = k;
    for (let round = 0; round < 20; round++) {
      // positions entières : beaucoup d'ex aequo
      const vehicles = Array.from({ length: 200 }, () => new Vehicle(400 + Math.round(rng() * 240 - 120), 300 + Math.round(rng() * 240 - 120)));
      const expected = vehicles.map(v => Math.hypot(v.pos.x - 400, v.pos.y - 300)).filter(d => d < 100)
        .sort((a, b) => a - b).slice(0, k);
      const got = Array.from(target.menacesProches(vehicles), m => m.distance);
      assert.equal(got.length, expected.length);
      got.forEach((d, i) => assert.ok(Math.abs(d - expected[i]) < EPS));
      const ids = target.menacesProches(vehicles).map(m => m.vehicle);
      assert.equal(new Set(ids).size, ids.length, 'aucun véhicule en double');
    }
  }
});

test('limite de menaces : allure fixée par la plus proche, force bornée, fuite dans le bon sens', () => {
  const { Vehicle, target } = setup();
  // une foule à gauche de la cible
  const crowd = Array.from({ length: 300 }, (_, i) => new Vehicle(390 - (i % 60), 300 + ((i * 7) % 61) - 30));
  const nearest = Math.min(...crowd.map(v => Math.hypot(v.pos.x - 400, v.pos.y - 300)));
  for (const maxMenaces of [1, 8, 300]) {
    target.maxMenaces = maxMenaces;
    const force = target.evadeVehicles(crowd);
    assert.ok(force.x > 0, `fuit vers la droite (k=${maxMenaces})`);
    assert.ok(force.mag() <= target.maxForce + EPS);
    assert.ok(Math.abs(target.maxSpeed - target.vitesseSelonDistance(nearest)) < EPS);
  }
});

test('aucun véhicule proche : force nulle, allure calme, pas de fuite', () => {
  const { Vehicle, target } = setup();
  target.maxSpeed = 99;
  const force = target.evadeVehicles([new Vehicle(600, 300)]);
  assert.deepEqual([force.x, force.y], [0, 0]);
  assert.equal(target.maxSpeed, target.vitesseCalme);
  assert.equal(target.enFuite, false);
  assert.equal(target.evadeVehicles([]).mag(), 0);
});

test('un véhicule proche : force opposée, limitée à maxForce, allure selon la distance', () => {
  for (const d of [1, 30, 70, 99]) {
    const { Vehicle, target } = setup();
    const force = target.evadeVehicles([new Vehicle(400 - d, 300)]);
    assert.equal(target.enFuite, true);
    assert.ok(force.x > 0, `fuit vers la droite à d=${d}`);
    assert.ok(Math.abs(force.y) < EPS);
    assert.ok(force.mag() <= target.maxForce + EPS);
    assert.ok(Math.abs(target.maxSpeed - target.vitesseSelonDistance(d)) < EPS);
  }
});

test('maxForce plus petite : la force de fuite reste bornée', () => {
  const { Vehicle, target } = setup();
  target.maxForce = 0.05;
  const force = target.evadeVehicles([new Vehicle(390, 300)]);
  assert.ok(force.mag() <= 0.05 + EPS && force.mag() > 0);
});

test('modes face à la menace : evade anticipe, flee non, ignore ne fuit pas', () => {
  const { Vehicle, target } = setup();
  // véhicule au-dessus, filant vers la droite : position future = (440, 250)
  const vehicle = new Vehicle(400, 250); vehicle.vel.set(4, 0);
  const evade = target.evadeVehicles([vehicle]);
  assert.ok(evade.x < 0 && evade.y > 0, 'evade : à l’opposé du point anticipé');
  target.threatMode = 'flee';
  const flee = target.evadeVehicles([vehicle]);
  assert.ok(Math.abs(flee.x) < EPS && flee.y > 0, 'flee : à l’opposé de la position actuelle');
  target.threatMode = 'ignore';
  const none = target.evadeVehicles([vehicle]);
  assert.equal(none.mag(), 0);
  assert.equal(target.enFuite, false);
  assert.equal(target.maxSpeed, target.vitesseCalme);
  assert.deepEqual([vehicle.pos.x, vehicle.pos.y], [400, 250], 'véhicule intact');
});

test('composition multi-menaces : la plus proche domine, symétrie annulée', () => {
  let { Vehicle, target } = setup();
  let force = target.evadeVehicles([new Vehicle(490, 300), new Vehicle(370, 300)]);
  assert.ok(force.x > 0, 'fuit à l’opposé du plus proche');
  assert.ok(Math.abs(target.maxSpeed - target.vitesseSelonDistance(30)) < EPS);

  ({ Vehicle, target } = setup());
  force = target.evadeVehicles([new Vehicle(350, 300), new Vehicle(450, 300)]);
  assert.ok(Math.abs(force.x) < EPS);
});

test('priorité : fuite > calme ; calme = seek du pointeur ou wander', () => {
  const { Vehicle, target } = setup();
  const pointer = new Vector(700, 300);
  let force = target.behaviors([new Vehicle(100, 100)], pointer);
  assert.ok(force.x > 0 && target.enFuite === false);
  force = target.behaviors([new Vehicle(430, 300)], pointer);
  assert.ok(force.x < 0 && target.enFuite === true, 'menace entre la cible et le pointeur');
  assert.equal(target.behaviors([], null).mag(), 0);

  target.calmMode = 'wander';
  target.wanderTheta = 0;
  force = target.behaviors([], pointer, () => 1);
  assert.ok(Math.abs(target.wanderTheta - target.wanderJitter) < EPS, 'wander utilisé (rng injecté)');
  assert.ok(force.mag() > 0 && force.mag() <= target.maxForce + EPS);
});

test('locomotion : accélère quand un véhicule colle, revient au calme hors du rayon', () => {
  const { Vehicle, target } = setup();
  const vehicle = new Vehicle(385, 300);
  let vitesseMax = 0;
  while (target.pos.dist(vehicle.pos) < target.rayonDetection) {
    target.applyForce(target.behaviors([vehicle], null));
    target.update();
    assert.ok(target.vel.mag() <= target.maxSpeed + EPS);
    assert.equal(target.acc.mag(), 0);
    vitesseMax = Math.max(vitesseMax, target.vel.mag());
  }
  assert.ok(vitesseMax > target.vitesseCalme + 1, 'plus rapide que l’allure calme');
  target.applyForce(target.behaviors([vehicle], null));
  target.update();
  assert.ok(Math.abs(target.vel.mag() - target.vitesseCalme) < EPS, 'ramenée à l’allure calme');
});

test('debug : le rayon de vision n’est dessiné qu’en mode debug', () => {
  const { target, calls } = setup();
  const visionDrawn = () => calls.some(([n, , , d]) => n === 'circle' && d === target.rayonDetection * 2);
  target.show();
  assert.equal(visionDrawn(), false);
  target.debug = true; target.show();
  assert.equal(visionDrawn(), true);
});
