const targets = [];
const vehicles = [];
// fragments des cibles éclatées
const particles = [];
let burstCount = 0;
const settings = SceneSettings.defaults();
let sceneCanvas;
let smoke;
// rendu GPU des véhicules (null si WebGL2 indisponible)
let vehicleGL;
// qualité automatique : vise 60 FPS en allégeant les effets si besoin
const governor = new QualityGovernor();
// point visé par les cibles au calme en mode "souris"
let pointer;
// centre de la zone où les véhicules n'apparaissent pas (suit la première cible)
let spawnGuard;
// grilles de hachage spatial reconstruites à chaque image
const vehicleGrid = new SpatialGrid(100);
const targetGrid = new SpatialGrid(100);

function sceneHeight() {
  return Math.max(1, windowHeight - document.getElementById('controls').offsetHeight);
}

function createTarget() {
  return new MitoticTarget(width / 2, height / 2);
}

function setup() {
  sceneCanvas = createCanvas(windowWidth, sceneHeight());
  sceneCanvas.parent('scene');
  pointer = createVector(width / 2, height / 2);
  spawnGuard = createVector(width / 2, height / 2);
  TargetColony.reset(targets, createTarget);
  smoke = SmokeTrails.create(width, height);
  vehicleGL = VehicleGL.create();

  const slider = document.getElementById('vehicle-count');
  slider.max = SeekPopulation.MAX_COUNT;
  slider.value = SeekPopulation.INITIAL_COUNT;
  SeekPopulation.bindSlider(slider, document.getElementById('vehicle-count-value'),
    vehicles, spawnGuard, () => ({ width, height }), (x, y) => new Hunter(x, y));

  if (!vehicleGL) {
    settings.gpuVehicles = false;
    document.getElementById('gpu-vehicles').disabled = true;
  }
  SettingsControls.bind(document.querySelectorAll('[data-setting]'), settings,
    id => document.querySelector(`output[for="${id}"]`),
    key => { if (key === 'autoQuality') governor.reset(); });
  document.getElementById('reset-targets').addEventListener('click',
    () => TargetColony.reset(targets, createTarget));

  // Les coordonnées sont relatives au canvas, pas aux contrôles.
  sceneCanvas.elt.addEventListener('pointermove', event => {
    const rect = sceneCanvas.elt.getBoundingClientRect();
    const x = (event.clientX - rect.left) * width / rect.width;
    const y = (event.clientY - rect.top) * height / rect.height;
    if (x >= 0 && x <= width && y >= 0 && y <= height) pointer.set(x, y);
  });
}

function draw() {
  const frameStart = performance.now();
  // niveau de qualité courant (pleine qualité si la qualité automatique est désactivée)
  const quality = settings.autoQuality ? governor.current() : QualityGovernor.LEVELS[0];
  clear();

  // 1. réglages courants appliqués aux entités (y compris les cibles nées à l'image précédente)
  for (const target of targets) SceneSettings.applyToTarget(target, settings, quality);
  for (const vehicle of vehicles) SceneSettings.applyToHunter(vehicle, settings);

  // 2. cycle de vie des cibles : vieillissement, division, détachement
  // (les filles copient les réglages de leur mère)
  TargetColony.step(targets, settings.maxTargets);
  spawnGuard.set(targets[0].pos.x, targets[0].pos.y);

  // 3. cibles : steering (fuite ou calme) puis locomotion héritée de Vehicle.
  //    Perception limitée par la grille : seuls les véhicules des cases proches sont examinés.
  vehicleGrid.clear(settings.detectionRadius);
  for (const vehicle of vehicles) vehicleGrid.insert(vehicle);
  for (const target of targets) {
    const voisins = vehicleGrid.query(target.pos, target.rayonDetection);
    target.applyForce(target.behaviors(voisins, pointer));
    target.update();
    target.edges();
  }

  // 4. véhicules : sélection de la cible la plus proche, puis seek/pursue et arrivée
  //    chaque arrivée sur une cible lui retire un point de vie
  targetGrid.clear(settings.detectionRadius);
  for (const target of targets) targetGrid.insert(target);
  for (const vehicle of vehicles) {
    const prey = vehicle.selectPrey(targets, targetGrid);
    if (SeekPopulation.step(vehicle, prey.pos, width, height)) prey.hit();
  }

  // 5. cibles détruites : éclatement en fragments ; il reste toujours une cible
  for (const target of TargetColony.removeDead(targets)) {
    particles.push(...BurstParticle.explode(target.pos, target.color));
    burstCount++;
  }
  TargetColony.ensureOne(targets, createTarget);
  for (const particle of particles) particle.update();
  for (let i = particles.length - 1; i >= 0; i--) if (particles[i].isDead()) particles.splice(i, 1);

  // 6. dessin : fumée sous les véhicules, cibles et fragments au-dessus
  if (settings.smoke && quality.smoke) {
    SmokeTrails.render(smoke, vehicles, millis() / 1000, width, height, drawingContext, quality.smokeScale);
  }
  // véhicules : un seul appel GPU instancié, ou un chemin Canvas par couleur ;
  // flèches de vitesse seulement en mode debug
  if (settings.gpuVehicles && vehicleGL) {
    VehicleGL.render(vehicleGL, vehicles, width, height, pixelDensity(), drawingContext);
  } else {
    VehicleBatch.drawBodies(drawingContext, vehicles);
  }
  if (settings.debug) VehicleBatch.drawArrows(drawingContext, vehicles);
  // cibles et fragments : rendu groupé (un chemin par couleur)
  TargetBatch.draw(drawingContext, targets);
  BurstParticle.drawAll(drawingContext, particles);
  document.getElementById('target-count').textContent = `Cibles : ${targets.length}`;
  document.getElementById('burst-count').textContent = `Éclatées : ${burstCount}`;
  if (frameCount % 30 === 0) {
    document.getElementById('fps').textContent = `FPS : ${Math.round(frameRate())}`;
    document.getElementById('quality').textContent =
      settings.autoQuality ? `Qualité : ${quality.label}` : 'Qualité : manuelle';
  }

  // durée de calcul de l'image (les copies des canvas WebGL attendent la fin du travail GPU)
  if (settings.autoQuality && !document.hidden) governor.update(performance.now() - frameStart);
}

function windowResized() {
  resizeCanvas(windowWidth, sceneHeight());
  pointer.set(constrain(pointer.x, 0, width), constrain(pointer.y, 0, height));
  for (const target of targets) target.edges();
  for (const vehicle of vehicles) vehicle.edges();
}
