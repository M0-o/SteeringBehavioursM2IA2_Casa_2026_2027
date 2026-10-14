// Hachage spatial (grille uniforme) : limite la perception au voisinage utile.
// Chaque image, la scène y range les entités par leur position ; une requête ne parcourt
// alors que les cases proches au lieu de toute la liste.
class SpatialGrid {
  constructor(cellSize) {
    this.cellSize = cellSize;
    this.cells = new Map();
    this.size = 0;
    // étendue des cases occupées (borne la recherche du plus proche)
    this.minX = Infinity; this.maxX = -Infinity;
    this.minY = Infinity; this.maxY = -Infinity;
  }

  cellOf(value) {
    return Math.floor(value / this.cellSize);
  }

  // clé numérique unique pour |ix|, |iy| < 2^20 (positions jusqu'à ~10^6 cases)
  key(ix, iy) {
    return (ix + 1048576) * 2097152 + (iy + 1048576);
  }

  // vide la grille ; la taille de case peut changer (rayon de vision réglable)
  clear(cellSize = this.cellSize) {
    this.cellSize = cellSize;
    this.cells.clear();
    this.size = 0;
    this.minX = Infinity; this.maxX = -Infinity;
    this.minY = Infinity; this.maxY = -Infinity;
  }

  insert(item) {
    const ix = this.cellOf(item.pos.x), iy = this.cellOf(item.pos.y);
    const k = this.key(ix, iy);
    let cell = this.cells.get(k);
    if (!cell) { cell = []; this.cells.set(k, cell); }
    cell.push(item);
    this.size++;
    if (ix < this.minX) this.minX = ix;
    if (ix > this.maxX) this.maxX = ix;
    if (iy < this.minY) this.minY = iy;
    if (iy > this.maxY) this.maxY = iy;
  }

  static from(items, cellSize) {
    const grid = new SpatialGrid(cellSize);
    for (const item of items) grid.insert(item);
    return grid;
  }

  /* Candidats des cases recouvrant le disque (pos, radius). Sur-ensemble : l'appelant
     garde son propre test de distance (ex. menacesProches). */
  query(pos, radius) {
    const result = [];
    const x0 = this.cellOf(pos.x - radius), x1 = this.cellOf(pos.x + radius);
    const y0 = this.cellOf(pos.y - radius), y1 = this.cellOf(pos.y + radius);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iy = y0; iy <= y1; iy++) {
        const cell = this.cells.get(this.key(ix, iy));
        if (cell) for (const item of cell) result.push(item);
      }
    }
    return result;
  }

  /* Élément le plus proche de pos (null si la grille est vide), exact : on parcourt
     des anneaux de cases de plus en plus larges, et on s'arrête dès qu'aucune case plus
     lointaine ne peut contenir un élément plus proche que le meilleur trouvé. */
  nearest(pos) {
    if (this.size === 0) return null;
    const cx = this.cellOf(pos.x), cy = this.cellOf(pos.y);
    const maxRing = Math.max(cx - this.minX, this.maxX - cx, cy - this.minY, this.maxY - cy);
    let best = null, bestD2 = Infinity;
    const visit = (ix, iy) => {
      const cell = this.cells.get(this.key(ix, iy));
      if (!cell) return;
      for (const item of cell) {
        const d2 = (item.pos.x - pos.x) ** 2 + (item.pos.y - pos.y) ** 2;
        if (d2 < bestD2) { best = item; bestD2 = d2; }
      }
    };
    for (let ring = 0; ring <= maxRing; ring++) {
      // une case de l'anneau "ring" est à au moins (ring - 1) * cellSize de pos
      const minDistance = (ring - 1) * this.cellSize;
      if (best && minDistance > 0 && minDistance * minDistance > bestD2) break;
      if (ring === 0) { visit(cx, cy); continue; }
      for (let i = -ring; i <= ring; i++) {
        visit(cx + i, cy - ring);
        visit(cx + i, cy + ring);
      }
      for (let i = -ring + 1; i <= ring - 1; i++) {
        visit(cx - ring, cy + i);
        visit(cx + ring, cy + i);
      }
    }
    return best;
  }
}
