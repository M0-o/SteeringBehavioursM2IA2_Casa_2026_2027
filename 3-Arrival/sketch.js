let game;
let controls;
let mouseTarget;
let font;
// p5 vaut mouseX = mouseY = 0 tant que la souris n'est pas passée sur la scène
let mouseSeen = false;

// Appelée avant de démarrer l'animation
function preload() {
  // en général on charge des images, des fontes de caractères etc.
  font = loadFont('./assets/inconsolata.otf');
}

function setup() {
  const stage = document.getElementById('stage');
  const canvas = createCanvas(stage.clientWidth, stage.clientHeight);
  canvas.parent('stage');
  textFont(font);

  // La cible, ce sera la position de la souris
  mouseTarget = createVector(width / 2, height / 2);

  game = new Game({ foodCount: 25 });
  game.addSnake(defaultSnakeSettings(), width / 2, height / 2);
  game.refillFood();

  controls = setupControls(game);
}

// appelée 60 fois par seconde
function draw() {
  background(12, 14, 20);

  // la cible garde la dernière position de la souris sur la scène
  if (mouseSeen && mouseInsideCanvas()) mouseTarget.set(mouseX, mouseY);

  if (!controls.state.paused) game.step(mouseTarget);
  game.show();
  controls.update();
}

function mouseInsideCanvas() {
  return mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height;
}

function mouseMoved() {
  if (mouseInsideCanvas()) mouseSeen = true;
}

function mousePressed() {
  if (mouseInsideCanvas()) controls.selectAt(mouseX, mouseY);
}

function windowResized() {
  const stage = document.getElementById('stage');
  resizeCanvas(stage.clientWidth, stage.clientHeight);
}

function keyPressed() {
  // pas de raccourci pendant la saisie dans le panneau
  if (document.activeElement && document.activeElement.matches('input, select')) return;
  if (key === 'd') {
    Vehicle.debug = !Vehicle.debug;
  } else if (key === ' ') {
    controls.togglePause();
    return false;
  }
}
