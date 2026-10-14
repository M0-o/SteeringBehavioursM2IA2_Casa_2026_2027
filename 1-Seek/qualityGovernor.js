// Qualité automatique (pas une entité) : surveille la durée de calcul des images et
// allège les effets coûteux quand le budget de 60 FPS est dépassé, puis les rétablit
// quand il y a de la marge. Le comportement des entités n'est jamais modifié, seulement
// le coût des effets visuels et, en dernier recours, le nombre de menaces perçues.
class QualityGovernor {
  // du plus beau au plus léger
  static LEVELS = [
    { label: 'pleine', smoke: true, smokeScale: 1, threatCap: Infinity },
    { label: 'fumée ½', smoke: true, smokeScale: 0.5, threatCap: Infinity },
    { label: 'fumée ¼', smoke: true, smokeScale: 0.25, threatCap: Infinity },
    { label: 'sans fumée', smoke: false, smokeScale: 0.25, threatCap: Infinity },
    { label: 'sans fumée, 3 menaces', smoke: false, smokeScale: 0.25, threatCap: 3 },
  ];

  /* budgetMs : durée visée pour une image (marge sous 16,7 ms pour le navigateur) ;
     degradeAfter : images consécutives au-dessus du budget avant d'alléger ;
     recoverAfter : images consécutives avec marge avant de rétablir un niveau ;
     recoverRatio : la marge, en fraction du budget ;
     smoothing : poids de la nouvelle mesure dans la moyenne lissée. */
  constructor({ budgetMs = 14, degradeAfter = 20, recoverAfter = 120, recoverRatio = 0.6, smoothing = 0.1 } = {}) {
    Object.assign(this, { budgetMs, degradeAfter, recoverAfter, recoverRatio, smoothing });
    this.reset();
  }

  reset() {
    this.level = 0;
    this.average = null;
    this.overFrames = 0;
    this.underFrames = 0;
    this.frame = 0;
    // délai de remontée vers chaque niveau, doublé à chaque rechute rapide (anti-oscillation)
    this.recoverDelay = QualityGovernor.LEVELS.map(() => this.recoverAfter);
    this.recoveredAt = QualityGovernor.LEVELS.map(() => -Infinity);
  }

  current() {
    return QualityGovernor.LEVELS[this.level];
  }

  // une mesure par image ; renvoie true si le niveau a changé
  update(frameMs) {
    this.frame++;
    // première mesure (démarrage, changement de niveau) plafonnée au budget : un pic isolé
    // ne suffit pas à alléger, une surcharge durable fait monter la moyenne en quelques images
    this.average = this.average === null
      ? Math.min(frameMs, this.budgetMs)
      : this.average + (frameMs - this.average) * this.smoothing;

    if (this.average > this.budgetMs) {
      this.overFrames++;
      this.underFrames = 0;
      if (this.overFrames >= this.degradeAfter && this.level < QualityGovernor.LEVELS.length - 1) {
        // rechute peu après être remonté à ce niveau : il faudra attendre deux fois plus
        if (this.frame - this.recoveredAt[this.level] < this.recoverDelay[this.level] * 2) {
          this.recoverDelay[this.level] *= 2;
        }
        this.level++;
        this.overFrames = 0;
        this.average = null;   // nouvelle mesure au nouveau niveau
        return true;
      }
    } else if (this.average < this.budgetMs * this.recoverRatio) {
      this.underFrames++;
      this.overFrames = 0;
      const target = this.level - 1;
      if (this.level > 0 && this.underFrames >= this.recoverDelay[target]) {
        this.level = target;
        this.recoveredAt[target] = this.frame;
        this.underFrames = 0;
        this.average = null;
        return true;
      }
    } else {
      // zone morte entre la marge et le budget : on ne change rien
      this.overFrames = 0;
      this.underFrames = 0;
    }
    return false;
  }
}
