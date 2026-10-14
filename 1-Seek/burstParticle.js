// Fragment projeté quand une cible éclate : un petit véhicule lancé vers l'extérieur,
// freiné par une force de traînée, qui s'estompe puis disparaît.
class BurstParticle extends Vehicle {
  // durée de vie d'un fragment (images)
  static LIFESPAN = 45;
  // paliers d'opacité du rendu groupé (un chemin par palier et par couleur)
  static ALPHA_STEPS = 8;

  constructor(x, y, color) {
    super(x, y);
    this.color = color;
    this.r = 4;
    this.maxSpeed = 8;
    this.maxForce = 1;
    // coefficient de traînée : fraction de la vitesse retirée à chaque image
    this.drag = 0.08;
    this.life = BurstParticle.LIFESPAN;
  }

  /* Éclatement : count fragments répartis régulièrement autour du centre,
     vitesse initiale vers l'extérieur légèrement variée par le rng injecté. */
  static explode(pos, color, count = 24, rng = Math.random) {
    const particles = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 2 + rng() * 4;
      const particle = new BurstParticle(pos.x, pos.y, color);
      particle.vel.set(Math.cos(angle) * speed, Math.sin(angle) * speed);
      particles.push(particle);
    }
    return particles;
  }

  // traînée : force opposée à la vitesse, proportionnelle, limitée à maxForce
  dragForce() {
    return this.vel.copy().mult(-this.drag).limit(this.maxForce);
  }

  update() {
    this.applyForce(this.dragForce());
    super.update();
    this.life--;
  }

  isDead() {
    return this.life <= 0;
  }

  // opacité (0-1) et rayon : le fragment s'estompe et rétrécit avec l'âge
  appearance() {
    const alpha = Math.max(this.life, 0) / BurstParticle.LIFESPAN;
    return { alpha, radius: this.r * (0.5 + 0.5 * alpha) };
  }

  show() {
    const { alpha, radius } = this.appearance();
    push();
    noStroke();
    fill(this.color);
    drawingContext.globalAlpha = alpha;
    circle(this.pos.x, this.pos.y, radius * 2);
    pop();
  }

  /* Rendu groupé : un chemin par couleur et par palier d'opacité (ALPHA_STEPS paliers),
     au lieu d'une dizaine d'appels de dessin par fragment. ctx : drawingContext de p5. */
  static drawAll(ctx, particles) {
    const groups = new Map();
    for (const particle of particles) {
      const { alpha, radius } = particle.appearance();
      const step = Math.round(alpha * BurstParticle.ALPHA_STEPS);
      if (step === 0) continue;
      const key = `${particle.color}|${step}`;
      if (!groups.has(key)) groups.set(key, { color: String(particle.color), alpha: step / BurstParticle.ALPHA_STEPS, items: [] });
      groups.get(key).items.push([particle.pos.x, particle.pos.y, radius]);
    }
    ctx.save();
    for (const { color, alpha, items } of groups.values()) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      for (const [x, y, radius] of items) {
        ctx.moveTo(x + radius, y);
        ctx.arc(x, y, radius, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.restore();
  }
}
