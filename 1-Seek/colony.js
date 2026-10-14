// Gestion de scène des cibles qui se divisent : aucun calcul de steering ici.
const TargetColony = (() => {
  /* Fait vieillir chaque cellule puis ajoute les filles des cellules prêtes,
     sans dépasser maxTargets. Renvoie les nouvelles cibles. */
  function step(targets, maxTargets, rng = Math.random) {
    for (const target of targets) target.tick();
    const born = [];
    for (const target of targets) {
      if (targets.length + born.length >= maxTargets) break;
      if (target.readyToDivide()) born.push(target.divide(rng));
    }
    targets.push(...born);
    return born;
  }

  /* Retire les cibles détruites (isDead) et renvoie-les, pour l'effet d'éclatement.
     Une cellule en plein bourgeonnement libère d'abord sa partenaire. */
  function removeDead(targets) {
    const dead = targets.filter(target => target.isDead());
    for (const target of dead) {
      if (target.detach) target.detach();
      targets.splice(targets.indexOf(target), 1);
    }
    return dead;
  }

  // Une seule cible, au centre de la scène
  function reset(targets, createTarget) {
    targets.length = 0;
    targets.push(createTarget());
  }

  // La scène garde toujours au moins une cible (les véhicules ont besoin d'une proie)
  function ensureOne(targets, createTarget) {
    if (targets.length === 0) reset(targets, createTarget);
  }

  return { step, removeDead, reset, ensureOne };
})();
