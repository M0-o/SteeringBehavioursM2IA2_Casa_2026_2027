// Véhicule chasseur : choisit la cible la plus proche puis la vise (seek) ou l'anticipe (pursue).
class Hunter extends Vehicle {
  static MODES = ['seek', 'pursue'];
  static COLORS = { seek: 'blue', pursue: 'purple' };

  constructor(x, y) {
    super(x, y);
    this.mode = 'seek';
    // nombre d'images d'anticipation en mode pursue
    this.anticipation = 10;
    // cible choisie à cette image (sélection de l'action)
    this.prey = null;
  }

  setMode(mode) {
    this.mode = Hunter.MODES.includes(mode) ? mode : 'seek';
    this.fillColor = Hunter.COLORS[this.mode];
  }

  /* Sélection de l'action : la cible la plus proche (null si aucune).
     grid (optionnel) : SpatialGrid des cibles, pour ne parcourir que les cases proches. */
  selectPrey(targets, grid = null) {
    if (grid) {
      this.prey = grid.nearest(this.pos);
      return this.prey;
    }
    let best = null, bestDistance = Infinity;
    for (const target of targets) {
      const d = p5.Vector.dist(this.pos, target.pos);
      if (d < bestDistance) { best = target; bestDistance = d; }
    }
    this.prey = best;
    return best;
  }

  // Steering : remplace le seek fixe de Vehicle.applyBehaviors selon le mode courant
  applyBehaviors(point) {
    const force = this.mode === 'pursue' && this.prey
      ? this.pursue(this.prey, this.anticipation)
      : this.seek(point);
    this.applyForce(force);
  }
}
