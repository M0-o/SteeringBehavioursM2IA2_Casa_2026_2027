// Nourriture : un Vehicle immobile tant qu'aucune tête n'est proche.
// Dès que le champ magnétique d'une tête la touche, elle est aspirée vers
// cette tête avec seek, d'autant plus fort qu'elle est proche (effet aimant).
class Food extends Vehicle {
  // vitesse d'aspiration (multipliée par la force de l'aimant du serpent)
  static pullSpeed = 8;
  // force d'aspiration maximale (au contact de la tête)
  static pullForce = 1.2;
  // part de la force disponible dès l'entrée dans le champ
  static minPull = 0.25;
  static brakeForce = 0.3;
  static colors = { 1: '#7cfc8a', 2: '#ffd166', 3: '#ff6b9a' };

  constructor(x, y, value = 1) {
    super(x, y);
    this.value = value;
    this.r = 4 + value * 2;
    this.attractor = null;
    // décalage de la pulsation, pour que toutes ne battent pas en même temps
    this.phase = (x * 0.05 + y * 0.03) % (Math.PI * 2);
  }

  // Sélection de l'action : la tête la plus proche dont le champ touche la nourriture.
  findAttractor(snakes) {
    let best = null;
    let bestDistance = Infinity;
    for (const snake of snakes) {
      if (!snake.attracts(this)) continue;
      const d = p5.Vector.dist(this.pos, snake.pos);
      if (d < bestDistance) {
        best = snake;
        bestDistance = d;
      }
    }
    this.attractor = best;
    return best;
  }

  // seek vers la tête; la force maximale grandit quand la distance diminue.
  magnetForce(snake) {
    const reach = snake.magnetRadius + this.r;
    const d = p5.Vector.dist(this.pos, snake.pos);
    const closeness = reach > 0 ? 1 - Math.min(d / reach, 1) : 1;
    const strength = snake.magnetStrength;

    this.maxSpeed = Food.pullSpeed * strength + snake.vel.mag();
    this.maxForce = Food.pullForce * strength * (Food.minPull + (1 - Food.minPull) * closeness);
    return this.seek(snake.pos);
  }

  // Hors de tout champ : vitesse désirée nulle (arrive sur sa propre position),
  // la nourriture freine jusqu'à l'arrêt.
  brake() {
    this.maxForce = Food.brakeForce;
    return this.arrive(this.pos);
  }

  behave(snakes) {
    const snake = this.findAttractor(snakes);
    this.applyForce(snake ? this.magnetForce(snake) : this.brake());
    this.update();
  }

  show() {
    const pulse = 1 + 0.12 * Math.sin(frameCount * 0.08 + this.phase);
    const c = Food.colors[this.value] ?? Food.colors[1];

    push();
    if (this.attractor) {
      // faisceau vers la tête qui aspire
      const beam = color(c);
      beam.setAlpha(120);
      stroke(beam);
      strokeWeight(1);
      line(this.pos.x, this.pos.y, this.attractor.pos.x, this.attractor.pos.y);
    }
    noStroke();
    const glow = color(c);
    glow.setAlpha(50);
    fill(glow);
    circle(this.pos.x, this.pos.y, this.r * 3.2 * pulse);
    fill(c);
    circle(this.pos.x, this.pos.y, this.r * 2 * pulse);
    pop();
  }
}
