// Panneau de réglages (DOM) : score, liste des serpents, éditeur du serpent
// sélectionné, réglages du monde. Ne contient aucune règle de mouvement.
function setupControls(game) {
  const $ = id => document.getElementById(id);
  const state = { selected: game.snakes[0] ?? null, paused: false, scoreboardKey: '' };

  // ----- construction des champs -----
  fillSelect($('snake-mode'), SNAKE_MODES);
  fillSelect($('snake-pattern'), SNAKE_PATTERNS);

  const sliders = {};
  for (const [key, spec] of Object.entries(SNAKE_SLIDERS)) {
    const label = document.createElement('label');
    label.className = 'slider';
    const title = document.createElement('span');
    title.textContent = spec.label;
    const output = document.createElement('output');
    const input = document.createElement('input');
    Object.assign(input, { type: 'range', min: spec.min, max: spec.max, step: spec.step, value: spec.value });
    label.append(title, output, input);
    $('snake-sliders').append(label);
    sliders[key] = { input, output };
  }

  const fields = {
    name: $('snake-name'),
    mode: $('snake-mode'),
    pattern: $('snake-pattern'),
    color: $('snake-color'),
    color2: $('snake-color2'),
  };

  function readEditor() {
    const settings = {};
    for (const [key, field] of Object.entries(fields)) settings[key] = field.value;
    for (const [key, { input }] of Object.entries(sliders)) settings[key] = Number(input.value);
    return clampSnakeSettings(settings);
  }

  function writeEditor(settings) {
    for (const [key, field] of Object.entries(fields)) field.value = settings[key];
    for (const [key, slider] of Object.entries(sliders)) {
      slider.input.value = settings[key];
      slider.output.textContent = settings[key];
    }
  }

  // ----- sélection -----
  function refreshSnakeList() {
    const select = $('snake-select');
    select.replaceChildren(...game.snakes.map((snake, i) => {
      const option = document.createElement('option');
      option.value = i;
      option.textContent = snake.name;
      option.selected = snake === state.selected;
      return option;
    }));
    select.disabled = game.snakes.length === 0;
    $('remove-snake').disabled = !state.selected;
  }

  function select(snake) {
    state.selected = snake;
    if (snake) writeEditor(snake.settings);
    refreshSnakeList();
  }

  // ----- édition en direct du serpent sélectionné -----
  function onEdit(key, value) {
    if (sliders[key]) sliders[key].output.textContent = value;
    if (!state.selected) return;
    // un serpent garde toujours un nom
    if (key === 'name' && !value.trim()) return;
    state.selected.applySettings({ [key]: value });
    if (key === 'name') refreshSnakeList();
  }

  for (const [key, field] of Object.entries(fields)) {
    field.addEventListener('input', () => onEdit(key, field.value));
  }
  for (const [key, { input }] of Object.entries(sliders)) {
    input.addEventListener('input', () => onEdit(key, Number(input.value)));
  }

  $('snake-select').addEventListener('change', e => select(game.snakes[Number(e.target.value)] ?? null));

  $('spawn-snake').addEventListener('click', () => {
    const settings = readEditor();
    // un nom déjà utilisé est remplacé par un nom automatique
    if (game.snakes.some(s => s.name === settings.name)) settings.name = '';
    select(game.addSnake(settings));
  });
  $('random-snake').addEventListener('click', () => select(game.addSnake(randomSnakeSettings())));
  $('remove-snake').addEventListener('click', () => {
    game.removeSnake(state.selected);
    select(game.snakes[0] ?? null);
  });

  // ----- partie et monde -----
  $('reset').addEventListener('click', () => game.reset());
  $('pause').addEventListener('click', () => togglePause());

  const foodCount = $('food-count');
  foodCount.value = game.foodCount;
  $('food-count-value').textContent = game.foodCount;
  foodCount.addEventListener('input', () => {
    game.foodCount = Number(foodCount.value);
    $('food-count-value').textContent = game.foodCount;
    game.refillFood();
  });

  $('show-magnet').checked = Snake.showMagnet;
  $('show-magnet').addEventListener('change', e => (Snake.showMagnet = e.target.checked));
  $('debug').addEventListener('change', e => (Vehicle.debug = e.target.checked));

  function togglePause() {
    state.paused = !state.paused;
    $('pause').textContent = state.paused ? 'Resume' : 'Pause';
  }

  // ----- affichage du score (appelé à chaque image) -----
  function update() {
    $('score').textContent = game.score;
    $('best').textContent = game.best;
    $('debug').checked = Vehicle.debug;
    if (state.selected) $('snake-length').textContent = state.selected.segments.length;

    // le tableau n'est reconstruit que s'il a changé
    const ranking = [...game.snakes].sort((a, b) => b.score - a.score);
    const key = ranking.map(s => `${s.name}|${s.color}|${s.score}|${s.segments.length}`).join(';');
    if (key === state.scoreboardKey) return;
    state.scoreboardKey = key;
    $('scoreboard').replaceChildren(...ranking.map(snake => {
      const item = document.createElement('li');
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = snake.color;
      const name = document.createElement('span');
      name.textContent = snake.name;
      const score = document.createElement('strong');
      score.textContent = snake.score;
      const length = document.createElement('small');
      length.textContent = `${snake.segments.length} seg.`;
      item.append(dot, name, length, score);
      item.addEventListener('click', () => select(snake));
      return item;
    }));
  }

  // clic sur la scène : sélectionne le serpent dont la tête est sous la souris
  function selectAt(x, y) {
    const hit = game.snakes.find(s => Math.hypot(s.pos.x - x, s.pos.y - y) < s.r * 1.5);
    if (hit) select(hit);
  }

  select(state.selected);
  return { state, update, selectAt, togglePause, refreshSnakeList };
}

function fillSelect(select, options) {
  for (const [value, label] of Object.entries(options)) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.append(option);
  }
}
