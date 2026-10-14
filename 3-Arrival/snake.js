// Un serpent : l'instance de Snake EST sa tête (un Vehicle), et elle possède
// une chaîne d'anneaux SnakeSegment qui la suivent.
//
// Séparation de Reynolds :
// - sélection de l'action : selectTarget() choisit l'objectif selon le mode
// - steering : steer() combine les forces (objectif, bords, séparation)
// - locomotion : applyForce() + update() hérités de Vehicle
class Snake extends Vehicle {
  // les anneaux doivent pouvoir rattraper la tête...
  static segmentSpeedFactor = 2;
  // ...et freiner dans leur zone de freinage : force proportionnelle à leur
  // vitesse max (distance d'arrêt v² / 2a = v / (2 * agilité)), sinon ils
  // dépassent leur cible et se mettent en orbite autour de l'anneau précédent.
  static segmentAgility = 0.5;
  static maxLength = 150;
  // poids de la composition des forces
  static separationWeight = 1.5;
  static boundaryWeight = 2;
  static boundaryMargin = 60;
  // affichage du champ magnétique autour de la tête
  static showMagnet = true;

  constructor(x, y, settings = defaultSnakeSettings()) {
    super(x, y);
    this.segments = [];
    this.score = 0;
    this.eaten = 0;
    this.settings = defaultSnakeSettings();
    this.applySettings(settings);
  }

  // Applique tout ou partie des réglages (curseurs, listes, couleurs).
  applySettings(partial) {
    const s = clampSnakeSettings({ ...this.settings, ...partial });
    this.settings = s;
    this.name = s.name;
    this.color = s.color;
    this.color2 = s.color2;
    this.pattern = s.pattern;
    this.mode = s.mode;
    this.r = s.headSize;
    this.segmentSize = s.segmentSize;
    this.maxSpeed = s.maxSpeed;
    this.maxForce = s.maxForce;
    this.rayonZoneDeFreinage = s.brakingRadius;
    this.magnetRadius = s.magnetRadius;
    this.magnetStrength = s.magnetStrength;
    // la longueur des réglages est la longueur de départ (avant de manger)
    if ('length' in partial || this.segments.length === 0) {
      this.setLength(s.length);
    } else {
      this.restyleSegments();
    }
  }

  get baseLength() {
    return this.settings.length;
  }

  tail() {
    return this.segments.length ? this.segments[this.segments.length - 1] : this;
  }

  setLength(n) {
    n = Math.max(0, Math.min(Snake.maxLength, Math.round(n)));
    while (this.segments.length < n) {
      // nouvel anneau placé derrière la queue actuelle
      const last = this.tail();
      const behind = last.vel.mag() > 0 ? last.vel.copy() : createVector(1, 0);
      behind.setMag(-this.segmentSize);
      const segment = new SnakeSegment(last.pos.x + behind.x, last.pos.y + behind.y, this.segmentSize);
      segment.vel = last.vel.copy();
      this.segments.push(segment);
    }
    this.segments.length = n;
    this.restyleSegments();
  }

  grow(k = 1) {
    this.setLength(this.segments.length + k);
  }

  // Taille, couleur et capacités de chaque anneau.
  // Le corps s'affine vers la queue.
  restyleSegments() {
    const n = this.segments.length;
    this.segments.forEach((segment, i) => {
      const t = n > 1 ? i / (n - 1) : 0;
      segment.r = this.segmentSize * (1 - 0.45 * t);
      segment.maxSpeed = this.maxSpeed * Snake.segmentSpeedFactor;
      segment.maxForce = segment.maxSpeed * Snake.segmentAgility;
      segment.fillColor = this.segmentColor(i, t);
    });
  }

  segmentColor(i, t) {
    switch (this.pattern) {
      case 'striped':
        return i % 4 < 2 ? this.color : this.color2;
      case 'gradient':
        return lerpColor(color(this.color), color(this.color2), t);
      default:
        return this.color;
    }
  }

  // ----- sélection de l'action -----

  nearestFood(foods) {
    let best = null;
    let bestDistance = Infinity;
    for (const food of foods) {
      const d = p5.Vector.dist(this.pos, food.pos);
      if (d < bestDistance) {
        best = food;
        bestDistance = d;
      }
    }
    return best;
  }

  // Renvoie la position visée, ou null si la tête doit errer.
  selectTarget(mouse, foods = []) {
    if (this.mode === 'mouse') return mouse ?? null;
    if (this.mode === 'food') return this.nearestFood(foods)?.pos ?? null;
    return null;
  }

  // ----- steering -----

  // Séparation (Reynolds) entre têtes de serpents : s'éloigner des voisins
  // trop proches, d'autant plus fort qu'ils sont proches.
  separate(snakes) {
    const sum = createVector(0, 0);
    let count = 0;
    for (const other of snakes) {
      if (other === this) continue;
      const d = p5.Vector.dist(this.pos, other.pos);
      const desiredSeparation = (this.r + other.r) * 1.5;
      if (d > 0 && d < desiredSeparation) {
        const away = p5.Vector.sub(this.pos, other.pos);
        away.setMag(1 / d);
        sum.add(away);
        count++;
      }
    }
    if (count === 0) return createVector(0, 0);
    sum.setMag(this.maxSpeed);
    return p5.Vector.sub(sum, this.vel).limit(this.maxForce);
  }

  // boundaries() de Vehicle renvoie la vitesse désirée « réfléchie » par le
  // bord (vecteur nul loin des bords) : on en déduit la force de pilotage.
  stayInside(margin = Snake.boundaryMargin) {
    const desired = this.boundaries(0, 0, width, height, margin);
    if (desired.mag() === 0) return desired;
    return p5.Vector.sub(desired, this.vel).limit(this.maxForce);
  }

  // Somme pondérée des comportements, tronquée à maxForce.
  steer(mouse, foods = [], snakes = []) {
    const force = createVector(0, 0);
    const goal = this.selectTarget(mouse, foods);

    if (goal === null) {
      force.add(this.wander());
    } else if (this.mode === 'mouse') {
      force.add(this.arrive(goal));
    } else {
      force.add(this.seek(goal));
    }

    // en mode souris, la marge est nulle : seule une tête sortie de la scène
    // (poussée par la séparation) est ramenée, sans gêner la souris près des bords
    const margin = this.mode === 'mouse' ? 0 : Snake.boundaryMargin;
    force.add(this.stayInside(margin).mult(Snake.boundaryWeight));
    force.add(this.separate(snakes).mult(Snake.separationWeight));
    return force.limit(this.maxForce);
  }

  // ----- locomotion -----

  move(mouse, foods = [], snakes = []) {
    this.applyForce(this.steer(mouse, foods, snakes));
    this.update();

    let leader = this;
    for (const segment of this.segments) {
      segment.applyForce(segment.follow(leader));
      segment.update();
      leader = segment;
    }
  }

  // ----- nourriture -----

  // le champ magnétique de la tête touche la nourriture
  attracts(food) {
    return p5.Vector.dist(this.pos, food.pos) < this.magnetRadius + food.r;
  }

  // la nourriture est avalée quand son centre entre dans la tête
  canEat(food) {
    return p5.Vector.dist(this.pos, food.pos) < this.r;
  }

  eat(food) {
    this.score += food.value;
    this.eaten++;
    this.grow(food.value);
  }

  resetProgress() {
    this.score = 0;
    this.eaten = 0;
    this.setLength(this.baseLength);
  }

  // ----- dessin -----

  show() {
    if (Snake.showMagnet && this.magnetRadius > 0) this.showMagnetField();
    for (let i = this.segments.length - 1; i >= 0; i--) this.segments[i].show();
    this.showHead();
  }

  showMagnetField() {
    push();
    const field = color(this.color);
    field.setAlpha(18);
    fill(field);
    field.setAlpha(70);
    stroke(field);
    strokeWeight(1);
    circle(this.pos.x, this.pos.y, (this.magnetRadius) * 2);
    pop();
  }

  showHead() {
    push();
    translate(this.pos.x, this.pos.y);
    if (this.vel.mag() > 0.2) rotate(this.vel.heading());

    stroke(0, 90);
    strokeWeight(2);
    fill(this.color);
    circle(0, 0, this.r * 2);

    // yeux tournés dans la direction du déplacement
    const eyeX = this.r * 0.35;
    const eyeY = this.r * 0.45;
    const eye = this.r * 0.55;
    noStroke();
    fill(255);
    circle(eyeX, -eyeY, eye);
    circle(eyeX, eyeY, eye);
    fill(0);
    circle(eyeX + eye * 0.18, -eyeY, eye * 0.5);
    circle(eyeX + eye * 0.18, eyeY, eye * 0.5);
    pop();

    if (this.name) {
      push();
      noStroke();
      fill(255, 200);
      textAlign(CENTER, BOTTOM);
      textSize(12);
      text(`${this.name} · ${this.score}`, this.pos.x, this.pos.y - this.r - 6);
      pop();
    }
  }
}
