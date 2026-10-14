// Un anneau du corps du serpent.
// Il suit l'élément qui le précède (la tête ou l'anneau précédent) avec le
// comportement arrive(cible, d) de Vehicle : d est la distance de repos
// derrière la cible. Plus près que d, la vitesse désirée devient négative
// et l'anneau recule : le corps garde son espacement.
class SnakeSegment extends Vehicle {
  // recouvrement entre deux anneaux voisins (1 = cercles tangents)
  static overlap = 0.6;
  // Dans la zone de freinage, la vitesse désirée augmente de
  // maxSpeed / (rayon - espacement) par pixel d'écart. Au-delà de 1 par
  // image, l'anneau dépasse sa position de repos à chaque image et oscille :
  // la zone s'étend donc de maxSpeed * brakingReach pixels après l'espacement.
  static brakingReach = 1;

  constructor(x, y, r) {
    super(x, y);
    this.r = r;
    this.fillColor = '#ffffff';
  }

  // distance de repos entre cet anneau et celui qui le précède
  spacingTo(leader) {
    return (this.r + leader.r) * SnakeSegment.overlap;
  }

  follow(leader) {
    const spacing = this.spacingTo(leader);
    this.rayonZoneDeFreinage = spacing + this.maxSpeed * SnakeSegment.brakingReach;
    return this.arrive(leader.pos, spacing);
  }

  show() {
    push();
    noStroke();
    fill(this.fillColor);
    circle(this.pos.x, this.pos.y, this.r * 2);
    pop();
  }
}
