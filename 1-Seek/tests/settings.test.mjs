import test from 'node:test';
import assert from 'node:assert/strict';
import { scene, TARGET_FILES } from './helpers.mjs';

function load() {
  return scene([...TARGET_FILES, 'mitoticTarget.js', 'hunter.js', 'settings.js', 'controls.js'],
    ['MitoticTarget', 'Hunter', 'SceneSettings', 'SettingsControls']);
}

// élément de formulaire factice : value/checked + écouteurs
function element(id, setting, type, value, extra = {}) {
  const listeners = {};
  return { id, type, tagName: type === 'select' ? 'SELECT' : 'INPUT', value: String(value), checked: false,
    dataset: { setting, ...extra.dataset }, step: extra.step ?? '1', listeners,
    addEventListener: (name, fn) => { listeners[name] = fn; } };
}

test('applyToTarget / applyToHunter : chaque réglage atteint l’entité', () => {
  const { MitoticTarget, Hunter, SceneSettings } = load();
  const s = { ...SceneSettings.defaults(), targetThreat: 'flee', targetCalm: 'wander',
    detectionRadius: 180, calmSpeed: 1.5, panicSpeed: 9, targetMaxForce: 0.6, targetAnticipation: 20,
    wanderJitter: 0.7, divisionDelay: 3, budPush: 0.8, debug: true,
    vehicleBehavior: 'pursue', vehicleMaxSpeed: 7, vehicleMaxForce: 0.3, vehicleAnticipation: 15,
    maxThreats: 3 };
  const t = new MitoticTarget(0, 0);
  SceneSettings.applyToTarget(t, s);
  assert.deepEqual([t.threatMode, t.calmMode, t.rayonDetection, t.vitesseCalme, t.vitesseFuiteMax,
    t.maxForce, t.anticipation, t.wanderJitter, t.divisionDelay, t.budPush, t.debug],
  ['flee', 'wander', 180, 1.5, 9, 0.6, 20, 0.7, 180, 0.8, true]);
  assert.equal(t.maxMenaces, 3);
  const h = new Hunter(0, 0);
  SceneSettings.applyToHunter(h, s);
  assert.deepEqual([h.mode, h.fillColor, h.maxSpeed, h.maxForce, h.anticipation],
    ['pursue', 'purple', 7, 0.3, 15]);
});

test('allure de panique jamais inférieure à l’allure calme', () => {
  const { MitoticTarget, SceneSettings } = load();
  const t = new MitoticTarget(0, 0);
  SceneSettings.applyToTarget(t, { ...SceneSettings.defaults(), calmSpeed: 5, panicSpeed: 2 });
  assert.equal(t.vitesseFuiteMax, 5);
});

test('controls : valeurs initiales, mise à jour sur input/change, affichage formaté', () => {
  const { SceneSettings, SettingsControls } = load();
  const settings = SceneSettings.defaults();
  const radius = element('r', 'detectionRadius', 'range', 0, { step: '5', dataset: { unit: ' px' } });
  const force = element('f', 'targetMaxForce', 'range', 0, { step: '0.05' });
  const mode = element('m', 'targetThreat', 'select', '');
  const debug = element('d', 'debug', 'checkbox', '');
  const outputs = { r: {}, f: {} };
  const changes = [];
  SettingsControls.bind([radius, force, mode, debug], settings, id => outputs[id] ?? null,
    (key, value) => changes.push([key, value]));

  assert.equal(radius.value, '100'); assert.equal(outputs.r.value, '100 px');
  assert.equal(outputs.f.value, '0.30'); assert.equal(mode.value, 'evade'); assert.equal(debug.checked, false);

  radius.value = '185'; radius.listeners.input();
  force.value = '0.75'; force.listeners.input();
  mode.value = 'ignore'; mode.listeners.change();
  debug.checked = true; debug.listeners.change();
  assert.deepEqual([settings.detectionRadius, settings.targetMaxForce, settings.targetThreat, settings.debug],
    [185, 0.75, 'ignore', true]);
  assert.equal(typeof settings.detectionRadius, 'number');
  assert.equal(outputs.r.value, '185 px');
  assert.equal(changes.length, 4);
});

test('controls : réglage inconnu refusé', () => {
  const { SceneSettings, SettingsControls } = load();
  assert.throws(() => SettingsControls.bind([element('x', 'nope', 'range', 1)], SceneSettings.defaults()),
    /Réglage inconnu/);
});
