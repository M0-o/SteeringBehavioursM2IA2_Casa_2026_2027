class Vehicle {
  constructor(x, y) {
    // position du véhicule
    this.pos = createVector(x, y);
    // vitesse du véhicule
    this.vel = createVector(0, 0);
    // accélération du véhicule
    this.acc = createVector(0, 0);
    // vitesse maximale du véhicule
    this.maxSpeed = 4;
    // force maximale appliquée au véhicule
    this.maxForce = 0.1;
    // rayon du véhicule
    this.r = 16;
    // couleurs de dessin (modifiables par les sous-classes sans réécrire show)
    this.fillColor = "blue";
    this.strokeColor = "white";
    // paramètres de wander : cercle projeté devant le véhicule
    this.wanderDistance = 60;
    this.wanderRadius = 25;
    // variation maximale de l'angle sur le cercle à chaque image (radians)
    this.wanderJitter = 0.3;
    this.wanderTheta = 0;
  }

  
  applyBehaviors(target) {
    let force = this.seek(target);
    this.applyForce(force);
  }

  // seek est un comportement qui permet de faire se rapprocher le véhicule de 
  // la cible passée en paramètre (un vecteur p5.Vector, par exemple la position de 
  // la souris)
  seek(target) {
 
    // on calcule la direction vers la cible : la vitesse DESIREE
    // C'est l'ETAPE 1 (action : se diriger vers une cible)
    let desiredSpeed = p5.Vector.sub(target, this.pos);

    // Dessous c'est l'ETAPE 2 : le pilotage (comment on se dirige vers la cible)
    // on limite ce vecteur à la longueur maxSpeed
    desiredSpeed.setMag(this.maxSpeed);

    // Si on s'arrête ici, force = desiredSpeed

    // on calcule maintenant LA FORMULE MAGIQUE : force = desiredSpeed - currentSpeed
    let force = p5.Vector.sub(desiredSpeed, this.vel);

    // et on limite cette force à la longueur maxForce
    force.limit(this.maxForce);

    return force;
  }

  // comportement de fuite, inverse de seek
  flee(target) {
    // inverse de seek !
    return this.seek(target).mult(-1);
  }

  // position future d'un autre véhicule dans "frames" images, à vitesse constante
  predictPosition(vehicle, frames) {
    return p5.Vector.add(vehicle.pos, p5.Vector.mult(vehicle.vel, frames));
  }

  // poursuite : seek de la position future du véhicule
  pursue(vehicle, frames = 10) {
    return this.seek(this.predictPosition(vehicle, frames));
  }

  // évasion : flee de la position future du véhicule
  evade(vehicle, frames = 10) {
    return this.flee(this.predictPosition(vehicle, frames));
  }

  // errance : seek d'un point sur un cercle placé devant le véhicule.
  // L'angle sur le cercle varie un peu à chaque image (direction continue).
  wander(rng = Math.random) {
    this.wanderTheta += (rng() * 2 - 1) * this.wanderJitter;
    const heading = this.vel.mag() > 0 ? Math.atan2(this.vel.y, this.vel.x) : 0;
    const angle = heading + this.wanderTheta;
    const point = createVector(
      this.pos.x + Math.cos(heading) * this.wanderDistance + Math.cos(angle) * this.wanderRadius,
      this.pos.y + Math.sin(heading) * this.wanderDistance + Math.sin(angle) * this.wanderRadius);
    return this.seek(point);
  }

  // --------------------------------------------
  // LES DEUX METHODES SUIVANTES SONT INCHANGEES QUEL QUE SOIT LE COMPORTEMENT
  // --------------------------------------------
  // applyForce est une méthode qui permet d'appliquer une force au véhicule
  // en fait on additionne le vecteur force au vecteur accélération
  applyForce(force) {
    this.acc.add(force);
  }

  // appelée 60 fois par seconde par la boucle d'animation de p5 (la fonction draw 
  // dans sketch.js)
  update() {
    // on ajoute l'accélération à la vitesse. 
    // L'accélération est un incrément de vitesse
    // (accélératiion = dérivée de la vitesse)
    this.vel.add(this.acc);
    // on contraint la vitesse à la valeur maxSpeed
    this.vel.limit(this.maxSpeed);
    // on ajoute la vitesse à la position. La vitesse est un incrément de position, 
    // (la vitesse est la dérivée de la position)
    this.pos.add(this.vel);

    // on remet l'accélération à zéro
    this.acc.set(0, 0);
  }

  // On dessine le véhicule
  show() {
    // sauvegarde du contexte graphique (couleur pleine, fil de fer, 
    // épaisseur du trait, position et rotation du repère de référence)
    push();
    // formes fil de fer (blanc par défaut)
    stroke(this.strokeColor);
    // épaisseur du trait = 2
    strokeWeight(2);

    // formes pleines (bleu par défaut)
    fill(this.fillColor);

    // on déplace le repère de référence.
    translate(this.pos.x, this.pos.y);
    // et on le tourne. heading() renvoie l'angle du vecteur vitesse 
    // (c'est l'angle du véhicule)
    rotate(this.vel.heading());

    //circle(0, 0, this.r * 2);

    // Dessin d'un véhicule sous la forme d'un triangle. Comme s'il était droit, 
    // avec le 0, 0 en haut à gauche
    triangle(-this.r, -this.r / 2, -this.r, this.r / 2, this.r, 0);
    
    pop();

    // dessin sous la forme d'une flèche du vecteur vitesse
    this.drawVelocityVector();
  }

  drawVelocityVector() {
    push();

    // Dessin du vecteur vitesse
    // Il part du centre du véhicule et va dans la direction du vecteur vitesse
    strokeWeight(3);
    stroke("red");
    line(this.pos.x, this.pos.y, this.pos.x + this.vel.x * 10, this.pos.y + this.vel.y * 10);
    // dessine une petite fleche au bout du vecteur vitesse
    let arrowSize = 5;
    translate(this.pos.x + this.vel.x * 10, this.pos.y + this.vel.y * 10);
    rotate(this.vel.heading());
    translate(-arrowSize / 2, 0);
    triangle(0, arrowSize / 2, 0, -arrowSize / 2, arrowSize, 0);

    pop();
  }
  
  // que fait cette méthode ?
  edges() {
    if (this.pos.x > width + this.r) {
      this.pos.x = -this.r;
    } else if (this.pos.x < -this.r) {
      this.pos.x = width + this.r;
    }
    if (this.pos.y > height + this.r) {
      this.pos.y = -this.r;
    } else if (this.pos.y < -this.r) {
      this.pos.y = height + this.r;
    }
  }
}