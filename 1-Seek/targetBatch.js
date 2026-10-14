// Rendu groupé des cibles (pas une entité) : mêmes formes et couleurs que show(),
// lues sur les cibles (visionColor, neckQuad, bodyColor, healthBar, healthColor),
// mais un chemin Canvas par couleur au lieu d'une dizaine d'appels par cible.
// Ordre identique à show() : vision (debug), pont de mitose, corps, barres de vie.
const TargetBatch = (() => {
  // regroupe des éléments par clé de couleur, en conservant l'ordre d'apparition
  function groupBy(items, keyOf) {
    const groups = new Map();
    for (const item of items) {
      const key = String(keyOf(item));
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    return groups;
  }

  function circles(ctx, list, radiusOf) {
    ctx.beginPath();
    for (const t of list) {
      const r = radiusOf(t);
      ctx.moveTo(t.pos.x + r, t.pos.y);
      ctx.arc(t.pos.x, t.pos.y, r, 0, Math.PI * 2);
    }
  }

  function draw(ctx, targets) {
    ctx.save();

    // 1. rayons de vision (mode debug), contour d'1 px
    ctx.lineWidth = 1;
    for (const [color, list] of groupBy(targets.filter(t => t.debug), t => t.visionColor())) {
      circles(ctx, list, t => t.rayonDetection);
      ctx.strokeStyle = color;
      ctx.stroke();
    }

    // 2. ponts de mitose (cibles en bourgeonnement seulement)
    const necks = targets.map(t => (t.neckQuad ? [t, t.neckQuad()] : [t, null])).filter(([, q]) => q);
    for (const [color, list] of groupBy(necks, ([t]) => t.bodyColor())) {
      ctx.beginPath();
      for (const [, quad] of list) {
        ctx.moveTo(quad[0][0], quad[0][1]);
        for (let i = 1; i < 4; i++) ctx.lineTo(quad[i][0], quad[i][1]);
        ctx.closePath();
      }
      ctx.fillStyle = color;
      ctx.fill();
    }

    // 3. corps
    for (const [color, list] of groupBy(targets, t => t.bodyColor())) {
      circles(ctx, list, t => t.r);
      ctx.fillStyle = color;
      ctx.fill();
    }

    // 4. barres de vie : tous les fonds, puis les remplissages groupés par couleur
    const bars = targets.map(t => [t, t.healthBar()]);
    ctx.beginPath();
    for (const [, b] of bars) ctx.rect(b.x - 1, b.y - 1, b.w + 2, b.h + 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.588)';
    ctx.fill();
    for (const [color, list] of groupBy(bars, ([t, b]) => `rgb(${t.healthColor(b.ratio).join(', ')})`)) {
      ctx.beginPath();
      for (const [, b] of list) if (b.fillWidth > 0) ctx.rect(b.x, b.y, b.fillWidth, b.h);
      ctx.fillStyle = color;
      ctx.fill();
    }

    ctx.restore();
  }

  return { groupBy, draw };
})();
