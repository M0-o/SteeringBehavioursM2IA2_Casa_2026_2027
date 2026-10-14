// Cible qui se divise : après divisionDelay images, une fille bourgeonne sur la mère
// (comme une mitose), grossit en s'éloignant, puis se détache et vit sa propre vie.
class MitoticTarget extends EvadingTarget {
  // la fille naît à cette fraction du rayon et grossit jusqu'à sa taille pleine
  static BUD_START_SCALE = 0.35;
  // écart (px) entre les deux membranes au moment où elles se détachent
  static BUD_GAP = 8;
  // durée maximale d'un bourgeonnement (images), au cas où la fuite empêche la séparation
  static BUD_MAX_FRAMES = 180;

  constructor(x, y) {
    super(x, y);
    this.fullRadius = this.r;
    // images écoulées depuis la naissance ou la dernière division
    this.age = 0;
    // délai avant division (images, ≈ 8 s à 60 fps)
    this.divisionDelay = 480;
    // intensité de la poussée qui écarte mère et fille (fraction de maxForce)
    this.budPush = 0.5;
    // { partner, isParent, frames } pendant un bourgeonnement, sinon null
    this.bud = null;
  }

  readyToDivide() {
    return !this.bud && this.age >= this.divisionDelay;
  }

  /* Crée la fille, collée à la mère sur un axe perpendiculaire à la vitesse.
     Renvoie la fille : c'est la scène qui l'ajoute à la liste des cibles. */
  divide(rng = Math.random) {
    const speed = this.vel.mag();
    const axisAngle = speed > 0 ? Math.atan2(this.vel.y, this.vel.x) + Math.PI / 2 : rng() * Math.PI * 2;
    const axis = createVector(Math.cos(axisAngle), Math.sin(axisAngle));

    const daughter = new this.constructor(this.pos.x + axis.x * 0.5, this.pos.y + axis.y * 0.5);
    daughter.copyParametersFrom(this);
    daughter.vel = this.vel.copy();
    daughter.r = this.fullRadius * MitoticTarget.BUD_START_SCALE;

    this.bud = { partner: daughter, isParent: true, frames: 0 };
    daughter.bud = { partner: this, isParent: false, frames: 0 };
    this.age = 0;
    daughter.age = 0;
    return daughter;
  }

  // la fille hérite des réglages courants de la mère
  copyParametersFrom(other) {
    for (const key of ['rayonDetection', 'vitesseCalme', 'vitesseFuiteMax', 'anticipation',
      'maxForce', 'threatMode', 'calmMode', 'debug', 'divisionDelay', 'budPush',
      'wanderJitter', 'fullRadius', 'maxHealth', 'maxMenaces']) {
      this[key] = other[key];
    }
  }

  // distance de détachement : les deux membranes séparées de BUD_GAP
  separationDistance() {
    return this.fullRadius * 2 + MitoticTarget.BUD_GAP;
  }

  // 0 juste après la division, 1 au moment du détachement
  budProgress() {
    if (!this.bud) return 1;
    const d = p5.Vector.dist(this.pos, this.bud.partner.pos);
    return Math.min(Math.max(d / this.separationDistance(), 0), 1);
  }

  /* Horloge de la cellule, appelée une fois par image par la scène :
     vieillissement, croissance de la fille, détachement. */
  tick() {
    this.age++;
    if (!this.bud) return;
    this.bud.frames++;
    const progress = this.budProgress();
    if (!this.bud.isParent) {
      const start = MitoticTarget.BUD_START_SCALE;
      this.r = this.fullRadius * (start + (1 - start) * progress);
    }
    if (progress >= 1 || this.bud.frames >= MitoticTarget.BUD_MAX_FRAMES) this.detach();
  }

  detach() {
    if (!this.bud) return;
    const partner = this.bud.partner;
    this.bud = null;
    this.r = this.fullRadius;
    if (partner.bud && partner.bud.partner === this) partner.detach();
  }

  // poussée pure qui éloigne la cellule de sa partenaire (le long de l'axe de division)
  budSeparation() {
    const away = p5.Vector.sub(this.pos, this.bud.partner.pos);
    if (away.mag() === 0) return createVector(0, 0);
    return away.setMag(this.maxForce * this.budPush);
  }

  /* Pendant le bourgeonnement, la poussée s'ajoute au comportement hérité
     (fuite ou calme), puis la somme est limitée à maxForce. */
  behaviors(vehicles, pointer, rng = Math.random) {
    const force = super.behaviors(vehicles, pointer, rng);
    if (!this.bud) return force;
    return force.add(this.budSeparation()).limit(this.maxForce);
  }

  // pont de cytoplasme entre mère et fille, qui s'amincit jusqu'au détachement
  /* Quatre sommets du pont mère -> fille, ou null : dessiné par la mère seulement,
     pendant un bourgeonnement (partagé par show() et le rendu groupé TargetBatch). */
  neckQuad() {
    if (!this.bud || !this.bud.isParent) return null;
    const partner = this.bud.partner;
    const axis = p5.Vector.sub(partner.pos, this.pos);
    if (axis.mag() === 0) return null;
    const normal = createVector(-axis.y, axis.x).setMag(
      Math.min(this.r, partner.r) * 0.8 * (1 - this.budProgress()));
    return [
      [this.pos.x + normal.x, this.pos.y + normal.y],
      [partner.pos.x + normal.x, partner.pos.y + normal.y],
      [partner.pos.x - normal.x, partner.pos.y - normal.y],
      [this.pos.x - normal.x, this.pos.y - normal.y],
    ];
  }

  drawNeck() {
    const corners = this.neckQuad();
    if (!corners) return;
    push();
    noStroke();
    fill(this.bodyColor());
    quad(...corners.flat());
    pop();
  }

  show() {
    this.drawNeck();
    super.show();
  }
}
