import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGame, Vector, EPS } from './helpers.mjs';

test('Snake hérite de Vehicle; ses anneaux sont des SnakeSegment (Vehicle)', () => {
  const { Vehicle, Snake, SnakeSegment } = loadGame();
  const snake = new Snake(100, 100, { length: 5 });
  assert.ok(snake instanceof Vehicle);
  assert.equal(snake.segments.length, 5);
  for (const s of snake.segments) assert.ok(s instanceof SnakeSegment && s instanceof Vehicle);
  // la locomotion et les comportements de base ne sont pas redéfinis
  for (const m of ['update', 'applyForce', 'seek', 'arrive', 'wander', 'boundaries']) {
    assert.equal(Snake.prototype[m], Vehicle.prototype[m], m);
  }
});

test('applySettings : propriétés de la tête et des anneaux', () => {
  const { Snake } = loadGame();
  const snake = new Snake(0, 0, {
    headSize: 20, segmentSize: 10, length: 3, maxSpeed: 6, maxForce: 0.5,
    brakingRadius: 150, magnetRadius: 90, magnetStrength: 2, color: '#112233', pattern: 'solid', mode: 'wander',
  });
  assert.deepEqual(
    [snake.r, snake.maxSpeed, snake.maxForce, snake.rayonZoneDeFreinage, snake.magnetRadius, snake.magnetStrength, snake.mode],
    [20, 6, 0.5, 150, 90, 2, 'wander'],
  );
  assert.equal(snake.segments[0].r, 10);
  assert.ok(snake.segments[2].r < snake.segments[0].r, 'le corps s\'affine vers la queue');
  for (const s of snake.segments) {
    assert.equal(s.maxSpeed, 6 * Snake.segmentSpeedFactor);
    assert.equal(s.maxForce, s.maxSpeed * Snake.segmentAgility);
    assert.equal(s.fillColor, '#112233');
  }
  // une modification partielle ne réinitialise pas la longueur acquise
  snake.grow(2);
  snake.applySettings({ maxSpeed: 3 });
  assert.equal(snake.segments.length, 5);
  assert.equal(snake.segments[4].maxSpeed, 3 * Snake.segmentSpeedFactor);
  // une valeur hors bornes est ramenée dans les bornes
  snake.applySettings({ maxForce: 50 });
  assert.equal(snake.maxForce, 2);
});

test('motifs : rayé alterne les deux couleurs, dégradé interpole', () => {
  const { Snake } = loadGame();
  const striped = new Snake(0, 0, { length: 4, pattern: 'striped', color: '#aaaaaa', color2: '#bbbbbb' });
  assert.deepEqual([...striped.segments.map(s => s.fillColor)], ['#aaaaaa', '#aaaaaa', '#bbbbbb', '#bbbbbb']);
  const gradient = new Snake(0, 0, { length: 3, pattern: 'gradient', color: '#aaaaaa', color2: '#bbbbbb' });
  assert.equal(gradient.segments[2].fillColor.value, 'lerp(#aaaaaa,#bbbbbb,1)');
});

test('setLength / grow : ajout derrière la queue, troncature, plafond', () => {
  const { Snake } = loadGame();
  const snake = new Snake(100, 100, { length: 2 });
  snake.vel = new Vector(2, 0);
  snake.segments.forEach(s => (s.vel = new Vector(2, 0)));
  const tail = snake.tail().pos.copy();
  snake.grow(1);
  assert.equal(snake.segments.length, 3);
  assert.ok(snake.tail().pos.x < tail.x, 'nouvel anneau derrière la queue');
  snake.setLength(0);
  assert.equal(snake.segments.length, 0);
  assert.equal(snake.tail(), snake);
  snake.setLength(10_000);
  assert.equal(snake.segments.length, Snake.maxLength);
});

test('selectTarget : souris, nourriture la plus proche, ou errance (null)', () => {
  const { Snake, Food } = loadGame();
  const mouse = new Vector(400, 300);
  const near = new Food(120, 100), far = new Food(700, 500);
  const snake = new Snake(100, 100);
  assert.equal(snake.selectTarget(mouse, [far, near]), mouse);
  snake.applySettings({ mode: 'food' });
  assert.equal(snake.selectTarget(mouse, [far, near]), near.pos);
  assert.equal(snake.selectTarget(mouse, []), null);
  snake.applySettings({ mode: 'wander' });
  assert.equal(snake.selectTarget(mouse, [near]), null);
});

test('steer : mode souris, force vers la souris, limitée à maxForce', () => {
  const { Snake } = loadGame();
  const snake = new Snake(100, 100, { maxForce: 0.4 });
  const f = snake.steer(new Vector(500, 100), [], [snake]);
  assert.ok(f.x > 0 && Math.abs(f.y) < EPS);
  assert.ok(f.mag() <= 0.4 + EPS);
});

test('steer : mode souris, arrive freine dans le rayon de freinage', () => {
  const { Snake } = loadGame();
  const snake = new Snake(100, 100, { maxSpeed: 5, maxForce: 2, brakingRadius: 100 });
  snake.vel = new Vector(5, 0);
  const f = snake.steer(new Vector(110, 100), [], [snake]);
  assert.ok(f.x < 0, 'proche de la cible : la force freine');
});

test('steer : mode nourriture, seek vers la plus proche', () => {
  const { Snake, Food } = loadGame();
  const snake = new Snake(400, 300, { mode: 'food' });
  const f = snake.steer(null, [new Food(400, 100), new Food(400, 500), new Food(400, 350)], [snake]);
  assert.ok(f.y > 0 && Math.abs(f.x) < EPS);
});

test('steer : mode errance, force de wander non nulle même sans cible', () => {
  const { Snake } = loadGame();
  const snake = new Snake(400, 300, { mode: 'wander', maxForce: 0.3 });
  snake.vel = new Vector(1, 0);
  const f = snake.steer(null, [], [snake]);
  assert.ok(f.mag() > 0 && f.mag() <= 0.3 + EPS);
});

test('separate : repousse une tête trop proche, rien au-delà', () => {
  const { Snake } = loadGame();
  const a = new Snake(100, 100, { headSize: 16 });
  const close = new Snake(110, 100, { headSize: 16 });
  const far = new Snake(400, 100, { headSize: 16 });
  const f = a.separate([a, close, far]);
  assert.ok(f.x < 0 && f.mag() <= a.maxForce + EPS);
  assert.equal(a.separate([a, far]).mag(), 0);
  // têtes superposées (d = 0) : pas de division par zéro
  const same = new Snake(100, 100);
  assert.ok(Number.isFinite(a.separate([a, same]).mag()));
});

test('separate + arrive : deux serpents sur la même cible restent séparés', () => {
  const { Snake } = loadGame();
  const a = new Snake(300, 290, { length: 0 }), b = new Snake(300, 310, { length: 0 });
  const mouse = new Vector(300, 300);
  for (let i = 0; i < 400; i++) { a.move(mouse, [], [a, b]); b.move(mouse, [], [a, b]); }
  assert.ok(a.pos.dist(b.pos) > a.r, `distance ${a.pos.dist(b.pos)}`);
  assert.ok(a.pos.dist(mouse) < 60 && b.pos.dist(mouse) < 60);
});

test('stayInside : près du bord gauche la force pousse vers la droite, rien au centre', () => {
  const { Snake } = loadGame();
  const snake = new Snake(10, 300, { maxForce: 0.5 });
  snake.vel = new Vector(-3, 0);
  const f = snake.stayInside(60);
  assert.ok(f.x > 0 && f.mag() <= 0.5 + EPS);
  const centered = new Snake(400, 300);
  assert.equal(centered.stayInside(60).mag(), 0);
});

test('steer : mode souris, une tête sortie de la scène y est ramenée, pas près du bord', () => {
  const { Snake } = loadGame();
  const outside = new Snake(-10, 300, { maxForce: 0.5 });
  outside.vel = new Vector(-3, 0);
  const f = outside.steer(new Vector(-10, 300), [], [outside]);
  assert.ok(f.x > 0 && f.mag() <= 0.5 + EPS);
  // dans la marge des autres modes, mais sur la scène : seule la souris compte
  const nearEdge = new Snake(20, 300, { maxForce: 0.5 });
  nearEdge.vel = new Vector(-3, 0);
  assert.equal(nearEdge.stayInside(0).mag(), 0);
});

test('move : plusieurs serpents sur une souris dans un coin restent dans la scène', () => {
  const { Snake } = loadGame();
  const snakes = [0, 1, 2, 3].map(i => new Snake(400 + i * 30, 300, { length: 5, maxSpeed: 15, maxForce: 0.3 }));
  const corner = new Vector(2, 2);
  for (let i = 0; i < 800; i++) for (const s of snakes) s.move(corner, [], snakes);
  for (const s of snakes) assert.ok(s.pos.x > -s.r * 2 && s.pos.y > -s.r * 2, `${s.pos.x}, ${s.pos.y}`);
});

test('move : la tête rejoint la souris, le corps suit en chaîne', () => {
  const { Snake } = loadGame();
  const snake = new Snake(100, 300, { length: 8, maxSpeed: 5, maxForce: 0.4 });
  const mouse = new Vector(600, 300);
  for (let i = 0; i < 500; i++) snake.move(mouse, [], [snake]);
  assert.ok(snake.pos.dist(mouse) < 5, `tête à ${snake.pos.dist(mouse)}`);
  let leader = snake;
  for (const s of snake.segments) {
    const gap = s.pos.dist(leader.pos);
    assert.ok(gap < s.spacingTo(leader) * 1.5, `écart ${gap}`);
    leader = s;
  }
});

test('move : corps rapide, pas d\'orbite des anneaux après un arrêt brusque de la tête', () => {
  const { Snake } = loadGame();
  for (const maxSpeed of [3, 8, 15]) {
    const snake = new Snake(100, 100, { length: 40, maxSpeed, maxForce: 0.2 });
    const corner = new Vector(5, 5);
    // la tête traverse la scène puis s'arrête dans un coin
    for (let i = 0; i < 300; i++) snake.move(new Vector(700, 500), [], [snake]);
    for (let i = 0; i < 600; i++) snake.move(corner, [], [snake]);
    let leader = snake;
    for (const s of snake.segments) {
      const gap = s.pos.dist(leader.pos);
      assert.ok(gap < s.spacingTo(leader) * 1.5, `vitesse ${maxSpeed} : écart ${gap.toFixed(1)}`);
      leader = s;
    }
  }
});

test('attracts / canEat : champ magnétique et bouche', () => {
  const { Snake, Food } = loadGame();
  const snake = new Snake(0, 0, { headSize: 16, magnetRadius: 80 });
  const food = new Food(85, 0, 1); // r = 6
  assert.ok(snake.attracts(food), 'le champ touche le bord de la nourriture');
  food.pos.x = 87;
  assert.ok(!snake.attracts(food));
  assert.ok(!snake.canEat(food));
  food.pos.x = 15;
  assert.ok(snake.canEat(food));
  snake.applySettings({ magnetRadius: 0 });
  food.pos.x = 30;
  assert.ok(!snake.attracts(food), 'sans aimant, aucune attraction à distance');
});

test('eat / resetProgress : score, croissance, retour à la longueur de départ', () => {
  const { Snake, Food } = loadGame();
  const snake = new Snake(0, 0, { length: 4 });
  snake.eat(new Food(0, 0, 3));
  snake.eat(new Food(0, 0, 1));
  assert.deepEqual([snake.score, snake.eaten, snake.segments.length], [4, 2, 8]);
  snake.resetProgress();
  assert.deepEqual([snake.score, snake.eaten, snake.segments.length], [0, 0, 4]);
});

test('show : dessine champ, anneaux, tête et nom sans erreur', () => {
  const env = loadGame();
  const snake = new env.Snake(50, 50, { length: 3, name: 'Kaa' });
  snake.show();
  assert.ok(env.calls.some(c => c[0] === 'text' && c[1] === 'Kaa · 0'));
  assert.ok(env.calls.filter(c => c[0] === 'circle').length >= 3 + 1 + 1);
});
