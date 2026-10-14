class Target extends Vehicle {
  constructor(x, y) {
    super(x, y);
    this.r = 50; // rayon de la cible
    this.color = 'red';
    this.vel = p5.Vector.random2D(); // vitesse initiale aléatoire
    // Vitesse max aléatoire enter 1 et 6
    this.vel.setMag(random(1, 6));

    // Mouvement erratique d'origine (changement brusque toutes les ~60 images
    // et petite rotation de la vitesse à chaque image). Compté en images plutôt
    // qu'avec setInterval : pas de timer qui survit à la cible, et une sous-classe
    // peut le désactiver avec erratic = false.
    this.erratic = true;
    this.erraticPeriod = 60;
    this.erraticFrames = 0;
  }

  // Changer la direction de la vitesse aléatoirement
  randomize() {
    this.vel = p5.Vector.random2D();
    this.vel.setMag(random(1, 6));
    // change le rayon aussi
    this.r = random(20, 50);
    // et de couleur
    this.color = color(random(255), random(255), random(255));
    // et l'accélération
    this.acc = p5.Vector.random2D();
    this.acc.setMag(random(0.1, 0.5));
  }

  update() {
    if (this.erratic) {
      this.erraticFrames++;
      if (this.erraticFrames >= this.erraticPeriod) {
        this.erraticFrames = 0;
        this.randomize();
      }
      this.vel.setHeading(this.vel.heading() + random(-0.2, 0.2)); // changement aléatoire de direction
    }
    super.update();
  }

  show() {
    push();
    fill(this.color);
    noStroke();
    circle(this.pos.x, this.pos.y, this.r * 2);
    pop();
  }
}
