import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGame, seeded, Vector } from './helpers.mjs';

test('addSnake : noms automatiques, réglages appliqués, position aléatoire dans la scène', () => {
  const { Game, Snake } = loadGame();
  const game = new Game({ rng: seeded(1) });
  const a = game.addSnake({ maxSpeed: 7 });
  const b = game.addSnake({ name: 'Kaa' }, 10, 20);
  const c = game.addSnake();
  assert.ok(a instanceof Snake);
  assert.deepEqual([a.name, b.name, c.name], ['Snake 1', 'Kaa', 'Snake 3']);
  assert.equal(a.maxSpeed, 7);
  assert.deepEqual([b.pos.x, b.pos.y], [10, 20]);
  assert.ok(a.pos.x >= Game.spawnMargin && a.pos.x <= 800 - Game.spawnMargin);
  game.removeSnake(b);
  assert.deepEqual([...game.snakes], [a, c]);
});

test('refillFood : exactement foodCount, positions dans la scène, reproductible', () => {
  const { Game, Food } = loadGame();
  const game = new Game({ foodCount: 40, rng: seeded(3) });
  game.refillFood();
  assert.equal(game.foods.length, 40);
  for (const f of game.foods) {
    assert.ok(f instanceof Food);
    assert.ok(f.pos.x >= 30 && f.pos.x <= 770 && f.pos.y >= 30 && f.pos.y <= 570);
    assert.ok([1, 2, 3].includes(f.value));
  }
  const again = new Game({ foodCount: 40, rng: seeded(3) });
  again.refillFood();
  assert.deepEqual(again.foods.map(f => [f.pos.x, f.pos.y, f.value]), game.foods.map(f => [f.pos.x, f.pos.y, f.value]));
  game.foodCount = 5;
  game.refillFood();
  assert.equal(game.foods.length, 5);
});

test('spawnFood : apparaît hors des champs magnétiques (pas de points gratuits)', () => {
  const { Game } = loadGame();
  const game = new Game({ foodCount: 200, rng: seeded(11) });
  const snake = game.addSnake({ magnetRadius: 250 }, 400, 300);
  game.refillFood();
  assert.equal(game.foods.length, 200);
  for (const f of game.foods) assert.ok(!snake.attracts(f));
});

test('spawnFood : scène entièrement couverte, la nourriture apparaît quand même', () => {
  const { Game, Food } = loadGame();
  const game = new Game({ rng: seeded(12) });
  game.addSnake({ magnetRadius: 250 }, 150, 150);
  game.addSnake({ magnetRadius: 250 }, 650, 150);
  game.addSnake({ magnetRadius: 250 }, 150, 450);
  game.addSnake({ magnetRadius: 250 }, 650, 450);
  game.addSnake({ magnetRadius: 250 }, 400, 300);
  assert.ok(game.spawnFood() instanceof Food);
  assert.equal(game.foods.length, 1);
});

test('randomFoodValue : seuils 70 % / 22 % / 8 %', () => {
  const { Game } = loadGame();
  const values = [0, 0.69, 0.7, 0.91, 0.92, 0.999].map(r => new Game({ rng: () => r }).randomFoodValue());
  assert.deepEqual(values, [1, 1, 2, 2, 3, 3]);
});

test('resolveEating : score, croissance, remplacement de la nourriture', () => {
  const { Game, Food } = loadGame();
  const game = new Game({ foodCount: 1, rng: seeded(5) });
  const snake = game.addSnake({ length: 2 }, 400, 300);
  game.foods = [new Food(405, 300, 2)];
  const eaten = [];
  game.onEat = (s, f) => eaten.push([s, f.value]);
  game.resolveEating();
  assert.equal(game.foods.length, 0);
  assert.deepEqual([game.score, game.best, snake.score, snake.segments.length], [2, 2, 2, 4]);
  assert.deepEqual(eaten, [[snake, 2]]);
});

test('resolveEating : la tête la plus proche mange, une seule fois', () => {
  const { Game, Food } = loadGame();
  const game = new Game();
  const a = game.addSnake({ headSize: 30 }, 100, 100);
  const b = game.addSnake({ headSize: 30 }, 120, 100);
  game.foods = [new Food(115, 100)];
  game.resolveEating();
  assert.deepEqual([a.score, b.score, game.score], [0, 1, 1]);
});

test('step : la nourriture dans le champ est aspirée puis mangée, puis remplacée', () => {
  const { Game, Food } = loadGame();
  const game = new Game({ foodCount: 1, rng: seeded(9) });
  const snake = game.addSnake({ length: 0, magnetRadius: 100 }, 400, 300);
  const mouse = new Vector(400, 300); // la tête reste sur place
  const food = new Food(480, 300);
  game.foods = [food];
  let frames = 0;
  while (game.score === 0 && frames < 200) { game.step(mouse); frames++; }
  assert.equal(game.score, 1, 'mangée par aspiration');
  assert.ok(frames > 1 && frames < 200);
  assert.equal(game.foods.length, 1);
  assert.notEqual(game.foods[0], food);
  assert.equal(snake.segments.length, 1);
});

test('step : hors du champ, la nourriture ne bouge pas', () => {
  const { Game, Food } = loadGame();
  const game = new Game({ foodCount: 1 });
  game.addSnake({ length: 0, magnetRadius: 50 }, 100, 100);
  const food = new Food(600, 500);
  game.foods = [food];
  for (let i = 0; i < 50; i++) game.step(new Vector(100, 100));
  assert.deepEqual([food.pos.x, food.pos.y], [600, 500]);
  assert.equal(game.score, 0);
});

test('reset : score à zéro, meilleur score conservé, longueurs de départ', () => {
  const { Game, Food } = loadGame();
  const game = new Game({ foodCount: 3, rng: seeded(2) });
  const snake = game.addSnake({ length: 5 }, 400, 300);
  game.foods = [new Food(400, 300, 3)];
  game.resolveEating();
  assert.equal(snake.segments.length, 8);
  game.reset();
  assert.deepEqual([game.score, game.best, snake.score, snake.segments.length, game.foods.length], [0, 3, 0, 5, 3]);
});

test('toutes les entités affichées par la partie étendent Vehicle', () => {
  const { Game, Vehicle } = loadGame();
  const game = new Game({ foodCount: 10, rng: seeded(4) });
  game.addSnake({ length: 6 });
  game.addSnake({ length: 3 });
  game.refillFood();
  const entities = [...game.foods, ...game.snakes, ...game.snakes.flatMap(s => s.segments)];
  assert.equal(entities.length, 10 + 2 + 9);
  for (const e of entities) assert.ok(e instanceof Vehicle, e.constructor.name);
  game.show();
});
