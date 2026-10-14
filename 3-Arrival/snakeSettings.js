// Réglages d'un serpent : bornes des curseurs, valeurs par défaut,
// normalisation et tirage aléatoire. Aucune dépendance à p5 : testable seul.

// Sélection de l'action de la tête :
// - mouse  : arrive sur la souris
// - wander : errance (wander de Vehicle) et reste dans l'écran
// - food   : seek de la nourriture la plus proche
const SNAKE_MODES = {
  mouse: 'Follow mouse',
  wander: 'Wander',
  food: 'Hunt food',
};

const SNAKE_PATTERNS = {
  solid: 'Solid',
  striped: 'Striped',
  gradient: 'Gradient',
};

// Curseurs : chaque clé correspond à une propriété des réglages.
const SNAKE_SLIDERS = {
  headSize: { label: 'Head size', min: 8, max: 40, step: 1, value: 16 },
  segmentSize: { label: 'Body thickness', min: 4, max: 36, step: 1, value: 12 },
  length: { label: 'Length (segments)', min: 0, max: 150, step: 1, value: 20 },
  maxSpeed: { label: 'Max speed', min: 0.5, max: 15, step: 0.5, value: 5 },
  maxForce: { label: 'Acceleration (max force)', min: 0.02, max: 2, step: 0.02, value: 0.3 },
  brakingRadius: { label: 'Braking radius', min: 10, max: 300, step: 5, value: 100 },
  magnetRadius: { label: 'Magnet radius', min: 0, max: 250, step: 5, value: 80 },
  magnetStrength: { label: 'Magnet strength', min: 0.1, max: 3, step: 0.1, value: 1 },
};

function defaultSnakeSettings() {
  const settings = {
    name: '',
    color: '#5ee07a',
    color2: '#1f7a4d',
    pattern: 'gradient',
    mode: 'mouse',
  };
  for (const [key, spec] of Object.entries(SNAKE_SLIDERS)) settings[key] = spec.value;
  return settings;
}

// Ramène chaque valeur dans ses bornes; une valeur invalide reprend la valeur par défaut.
function clampSnakeSettings(settings) {
  const defaults = defaultSnakeSettings();
  const s = { ...defaults, ...settings };

  for (const [key, spec] of Object.entries(SNAKE_SLIDERS)) {
    const value = Number(s[key]);
    s[key] = Number.isFinite(value) ? Math.min(spec.max, Math.max(spec.min, value)) : spec.value;
  }
  s.length = Math.round(s.length);

  if (!(s.mode in SNAKE_MODES)) s.mode = defaults.mode;
  if (!(s.pattern in SNAKE_PATTERNS)) s.pattern = defaults.pattern;
  if (!isHexColor(s.color)) s.color = defaults.color;
  if (!isHexColor(s.color2)) s.color2 = defaults.color2;
  s.name = String(s.name ?? '').trim();
  return s;
}

// rng : fonction qui renvoie un nombre dans [0, 1[, injectable pour les tests.
function randomSnakeSettings(rng = Math.random) {
  const settings = defaultSnakeSettings();
  for (const [key, spec] of Object.entries(SNAKE_SLIDERS)) {
    const steps = Math.round((spec.max - spec.min) / spec.step);
    settings[key] = spec.min + Math.floor(rng() * (steps + 1)) * spec.step;
  }
  // valeurs aléatoires restreintes à une plage jouable
  settings.length = 8 + Math.floor(rng() * 30);
  settings.maxSpeed = 2 + Math.floor(rng() * 13) * 0.5;
  settings.maxForce = 0.1 + Math.floor(rng() * 20) * 0.02;

  const hue = Math.floor(rng() * 360);
  settings.color = hslToHex(hue, 75, 60);
  settings.color2 = hslToHex((hue + 40 + Math.floor(rng() * 140)) % 360, 70, 35);

  const patterns = Object.keys(SNAKE_PATTERNS);
  settings.pattern = patterns[Math.floor(rng() * patterns.length)];
  return clampSnakeSettings(settings);
}

function isHexColor(value) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

// h en degrés, s et l en pourcentage -> "#rrggbb"
function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const channel = n => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}
