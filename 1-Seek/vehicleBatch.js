// Rendu groupé des véhicules (pas une entité) : une seule forme par couleur au lieu
// d'une dizaine d'appels de dessin par véhicule. Même triangle que Vehicle.show()
// (vérifié par les tests) ; Vehicle.show() reste disponible pour dessiner un véhicule seul.
const VehicleBatch = (() => {
  const ARROW_SCALE = 10;   // longueur de la flèche = vitesse × 10, comme drawVelocityVector
  const ARROW_HEAD = 5;

  // orientation du véhicule : cos/sin de l'angle de la vitesse (0 à l'arrêt, comme heading())
  function orientation(vel) {
    const speed = Math.hypot(vel.x, vel.y);
    return speed > 0 ? [vel.x / speed, vel.y / speed] : [1, 0];
  }

  // sommets du triangle (-r, -r/2), (-r, r/2), (r, 0), tournés puis translatés en pos
  function triangleFor(vehicle) {
    const [c, s] = orientation(vehicle.vel);
    const { x, y } = vehicle.pos, r = vehicle.r;
    const place = (lx, ly) => [x + lx * c - ly * s, y + lx * s + ly * c];
    return [place(-r, -r / 2), place(-r, r / 2), place(r, 0)];
  }

  // flèche de vitesse : segment + pointe triangulaire
  function arrowFor(vehicle) {
    const { x, y } = vehicle.pos;
    const tip = [x + vehicle.vel.x * ARROW_SCALE, y + vehicle.vel.y * ARROW_SCALE];
    const [c, s] = orientation(vehicle.vel);
    const back = [tip[0] - c * ARROW_HEAD / 2, tip[1] - s * ARROW_HEAD / 2];
    const h = ARROW_HEAD / 2;
    const head = [
      [back[0] - s * h, back[1] + c * h],
      [back[0] + s * h, back[1] - c * h],
      [back[0] + c * ARROW_HEAD, back[1] + s * ARROW_HEAD],
    ];
    return { from: [x, y], to: tip, head };
  }

  // véhicules regroupés par couleurs de remplissage et de contour
  function groupByStyle(vehicles) {
    const groups = new Map();
    for (const vehicle of vehicles) {
      const key = `${vehicle.fillColor}|${vehicle.strokeColor}`;
      if (!groups.has(key)) groups.set(key, { fill: vehicle.fillColor, stroke: vehicle.strokeColor, vehicles: [] });
      groups.get(key).vehicles.push(vehicle);
    }
    return [...groups.values()];
  }

  // corps des véhicules : un chemin par style
  function drawBodies(ctx, vehicles) {
    ctx.save();
    // contour d'abord, remplissage ensuite : dans un groupe de véhicules superposés,
    // les remplissages recouvrent les contours des autres (comme des dessins successifs).
    // Le remplissage cache la moitié intérieure du trait : 3 px ≈ le contour de 2 px d'origine.
    ctx.lineWidth = 3;
    ctx.lineJoin = 'miter';
    for (const group of groupByStyle(vehicles)) {
      ctx.beginPath();
      for (const vehicle of group.vehicles) {
        const [a, b, c] = triangleFor(vehicle);
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.lineTo(c[0], c[1]);
        ctx.closePath();
      }
      ctx.fillStyle = group.fill;
      ctx.strokeStyle = group.stroke;
      ctx.stroke();
      ctx.fill();
    }
    ctx.restore();
  }

  // flèches de vitesse (mode debug) : un chemin pour les segments, un pour les pointes
  function drawArrows(ctx, vehicles) {
    ctx.save();
    const arrows = vehicles.map(arrowFor);
    ctx.beginPath();
    for (const { from, to } of arrows) {
      ctx.moveTo(from[0], from[1]);
      ctx.lineTo(to[0], to[1]);
    }
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    for (const { head: [a, b, c] } of arrows) {
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.lineTo(c[0], c[1]);
      ctx.closePath();
    }
    ctx.fillStyle = 'red';
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /* ctx : contexte Canvas 2D (drawingContext en p5).
     options.arrows : dessine aussi les flèches de vitesse (mode debug). */
  function draw(ctx, vehicles, options = {}) {
    drawBodies(ctx, vehicles);
    if (options.arrows) drawArrows(ctx, vehicles);
  }

  return { orientation, triangleFor, arrowFor, groupByStyle, drawBodies, drawArrows, draw };
})();
