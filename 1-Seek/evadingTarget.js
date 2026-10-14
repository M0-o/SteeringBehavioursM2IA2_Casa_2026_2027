// Cible autonome : au calme suit le pointeur ou erre ; s'échappe des véhicules trop proches.
class EvadingTarget extends Target {
  // réponses possibles à une menace et comportements au calme (choisis dans l'interface)
  static THREAT_MODES = ['evade', 'flee', 'ignore'];
  static CALM_MODES = ['mouse', 'wander'];

  constructor(x, y) {
    super(x, y);
    // pas de mouvement erratique hérité de Target : seules les forces pilotent la cible
    this.erratic = false;
    this.vel.set(0, 0);
    this.r = SeekPopulation.ARRIVAL_RADIUS;
    this.color = 'red';

    // un véhicule plus proche que ce rayon (la "vision") déclenche la fuite
    this.rayonDetection = 100;
    // allure quand aucun véhicule n'est dans le rayon de détection
    this.vitesseCalme = 2;
    // allure quand un véhicule touche presque la cible
    this.vitesseFuiteMax = 6;
    // nombre d'images pour anticiper la position future d'un véhicule (mode evade)
    this.anticipation = 10;
    this.maxForce = 0.3;
    this.maxSpeed = this.vitesseCalme;

    // nombre maximal de menaces prises en compte (les plus proches) : au-delà,
    // leur poids dans la moyenne est faible et leur coût de calcul important
    this.maxMenaces = 8;

    this.threatMode = 'evade';
    this.calmMode = 'mouse';
    // en mode debug, le rayon de vision est dessiné
    this.debug = false;
    // vrai si au moins un véhicule est dans le rayon de détection
    this.enFuite = false;

    // santé : nombre de coups (véhicules arrivés sur la cible) avant d'éclater
    this.maxHealth = 5;
    this.damage = 0;
    // images restantes du flash blanc après un coup
    this.hitFlash = 0;
  }

  // Un véhicule a atteint la cible
  hit() {
    this.damage++;
    this.hitFlash = 6;
  }

  // 1 = intacte, 0 = détruite ; les coups reçus sont conservés si maxHealth change
  healthRatio() {
    return Math.min(Math.max(1 - this.damage / this.maxHealth, 0), 1);
  }

  isDead() {
    return this.damage >= this.maxHealth;
  }

  update() {
    if (this.hitFlash > 0) this.hitFlash--;
    super.update();
  }

  /* Perception : les maxMenaces véhicules les plus proches à moins de rayonDetection,
     triés du plus proche au plus éloigné. Cette boucle parcourt souvent des milliers de
     candidats (véhicules agglutinés autour de la cible) : distances calculées sur les
     coordonnées, et seules les k meilleures sont conservées, par insertion dans une liste
     triée de taille k (pas de tri ni d'objet créé pour les autres candidats). */
  menacesProches(vehicles) {
    const rayon2 = this.rayonDetection * this.rayonDetection;
    const k = this.maxMenaces;
    const best = [];   // { vehicle, d2 }, triés par d2 croissant, au plus k éléments
    for (const vehicle of vehicles) {
      if (vehicle === this) continue;
      const dx = vehicle.pos.x - this.pos.x, dy = vehicle.pos.y - this.pos.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rayon2) continue;
      if (best.length >= k && d2 >= best[best.length - 1].d2) continue;
      // place libre en fin de liste, ou remplacement du plus éloigné si la liste est pleine
      let i = best.length < k ? best.length : best.length - 1;
      if (best.length < k) best.push(null);
      while (i > 0 && best[i - 1].d2 > d2) { best[i] = best[i - 1]; i--; }
      best[i] = { vehicle, d2 };
    }
    return best.map(({ vehicle, d2 }) => ({ vehicle, distance: Math.sqrt(d2) }));
  }

  // 0 au bord du rayon de détection, 1 au contact
  proximite(distance) {
    return Math.min(Math.max(1 - distance / this.rayonDetection, 0), 1);
  }

  /* Allure voulue : vitesseCalme au bord du rayon (ou au-delà),
     croît linéairement jusqu'à vitesseFuiteMax au contact */
  vitesseSelonDistance(distance) {
    return this.vitesseCalme + (this.vitesseFuiteMax - this.vitesseCalme) * this.proximite(distance);
  }

  // force d'échappement face à un véhicule, selon le mode choisi
  escapeFrom(vehicle) {
    if (this.threatMode === 'flee') return this.flee(vehicle.pos);
    return this.evade(vehicle, this.anticipation);
  }

  /* Fuite de tous les véhicules dans le rayon de détection.
     - la menace la plus proche fixe l'allure (maxSpeed), utilisée par flee/evade
       pour la vitesse désirée et par update pour limiter la vitesse
     - chaque échappement est pondéré par la proximité de sa menace (moyenne pondérée) */
  evadeVehicles(vehicles) {
    const menaces = this.threatMode === 'ignore' ? [] : this.menacesProches(vehicles);
    this.enFuite = menaces.length > 0;

    if (!this.enFuite) {
      this.maxSpeed = this.vitesseCalme;
      return createVector(0, 0);
    }

    this.maxSpeed = this.vitesseSelonDistance(menaces[0].distance);

    const force = createVector(0, 0);
    let sommePoids = 0;
    menaces.forEach(({ vehicle, distance }) => {
      const poids = this.proximite(distance);
      force.add(this.escapeFrom(vehicle).mult(poids));
      sommePoids += poids;
    });
    if (sommePoids > 0) force.mult(1 / sommePoids);

    return force.limit(this.maxForce);
  }

  // comportement au calme : vers le pointeur (s'il existe) ou errance
  calmForce(pointer, rng = Math.random) {
    if (this.calmMode === 'wander') return this.wander(rng);
    return pointer ? this.seek(pointer) : createVector(0, 0);
  }

  /* Composition par priorité : la fuite l'emporte sur le comportement au calme. */
  behaviors(vehicles, pointer, rng = Math.random) {
    const fuite = this.evadeVehicles(vehicles);
    if (this.enFuite) return fuite;
    return this.calmForce(pointer, rng);
  }

  // --- apparence (partagée par show() et le rendu groupé TargetBatch) ---

  visionColor() {
    return this.enFuite ? 'orange' : 'rgba(255, 255, 255, 0.6)';
  }

  // flash blanc bref après un coup, sinon la couleur de la cible
  bodyColor() {
    return this.hitFlash > 0 ? 'white' : this.color;
  }

  // barre de vie au-dessus de la cible : fond, puis remplissage proportionnel à la santé
  healthBar() {
    const w = Math.max(this.r * 2, 24), h = 4;
    const x = this.pos.x - w / 2, y = this.pos.y - this.r - 10;
    const ratio = this.healthRatio();
    return { x, y, w, h, ratio, fillWidth: w * ratio };
  }

  // verte pleine, vire au rouge en se vidant
  healthColor(ratio = this.healthRatio()) {
    return [Math.round(255 * (1 - ratio)), Math.round(200 * ratio + 40), 60];
  }

  drawVision() {
    push();
    noFill();
    strokeWeight(1);
    stroke(this.visionColor());
    circle(this.pos.x, this.pos.y, this.rayonDetection * 2);
    pop();
  }

  drawHealthBar() {
    const { x, y, w, h, fillWidth } = this.healthBar();
    push();
    noStroke();
    fill(0, 0, 0, 150);
    rect(x - 1, y - 1, w + 2, h + 2);
    fill(...this.healthColor());
    rect(x, y, fillWidth, h);
    pop();
  }

  show() {
    if (this.debug) this.drawVision();
    // flash : on prête la couleur du flash à Target.show, sans perdre la couleur d'origine
    const original = this.color;
    this.color = this.bodyColor();
    super.show();
    this.color = original;
    this.drawHealthBar();
  }
}
