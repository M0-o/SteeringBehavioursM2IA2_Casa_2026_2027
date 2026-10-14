// Contrôleur de la partie (non affiché) : liste des serpents et de la
// nourriture, score, apparition de la nourriture, collisions.
class Game {
  // probabilités cumulées des valeurs de nourriture : 1 (70 %), 2 (22 %), 3 (8 %)
  static foodValues = [[0.7, 1], [0.92, 2], [1, 3]];
  static spawnMargin = 30;
  static spawnAttempts = 20;

  // rng : fonction qui renvoie un nombre dans [0, 1[, injectable pour les tests
  constructor({ foodCount = 25, rng = Math.random } = {}) {
    this.snakes = [];
    this.foods = [];
    this.foodCount = foodCount;
    this.rng = rng;
    this.score = 0;
    this.best = 0;
    this.nextSnakeNumber = 1;
    this.onEat = null;
  }

  randomPosition() {
    const m = Game.spawnMargin;
    return createVector(m + this.rng() * (width - 2 * m), m + this.rng() * (height - 2 * m));
  }

  addSnake(settings = defaultSnakeSettings(), x, y) {
    if (x === undefined || y === undefined) ({ x, y } = this.randomPosition());
    const name = settings.name || `Snake ${this.nextSnakeNumber}`;
    this.nextSnakeNumber++;
    const snake = new Snake(x, y, { ...settings, name });
    this.snakes.push(snake);
    return snake;
  }

  removeSnake(snake) {
    this.snakes = this.snakes.filter(s => s !== snake);
  }

  randomFoodValue() {
    const roll = this.rng();
    return Game.foodValues.find(([threshold]) => roll < threshold)[1];
  }

  // La nourriture apparaît hors des champs magnétiques : un serpent immobile
  // ne doit pas marquer de points gratuits. Après spawnAttempts essais
  // (scène couverte par les champs), la dernière position est gardée.
  spawnFood() {
    const value = this.randomFoodValue();
    let food;
    for (let attempt = 0; attempt < Game.spawnAttempts; attempt++) {
      const { x, y } = this.randomPosition();
      food = new Food(x, y, value);
      if (!this.snakes.some(snake => snake.attracts(food))) break;
    }
    this.foods.push(food);
    return food;
  }

  // garde exactement foodCount morceaux de nourriture sur la scène
  refillFood() {
    if (this.foods.length > this.foodCount) this.foods.length = this.foodCount;
    while (this.foods.length < this.foodCount) this.spawnFood();
  }

  // La tête la plus proche qui peut avaler la nourriture la mange.
  resolveEating() {
    this.foods = this.foods.filter(food => {
      let eater = null;
      let bestDistance = Infinity;
      for (const snake of this.snakes) {
        const d = p5.Vector.dist(snake.pos, food.pos);
        if (snake.canEat(food) && d < bestDistance) {
          eater = snake;
          bestDistance = d;
        }
      }
      if (!eater) return true;
      eater.eat(food);
      this.score += food.value;
      this.best = Math.max(this.best, this.score);
      if (this.onEat) this.onEat(eater, food);
      return false;
    });
  }

  step(mouse) {
    for (const snake of this.snakes) snake.move(mouse, this.foods, this.snakes);
    for (const food of this.foods) food.behave(this.snakes);
    this.resolveEating();
    this.refillFood();
  }

  // Nouvelle partie : score à zéro, serpents ramenés à leur longueur de départ.
  reset() {
    this.score = 0;
    this.foods = [];
    for (const snake of this.snakes) snake.resetProgress();
    this.refillFood();
  }

  show() {
    for (const food of this.foods) food.show();
    for (const snake of this.snakes) snake.show();
  }
}
