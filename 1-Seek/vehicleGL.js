// Rendu GPU des véhicules (pas une entité) : WebGL2 instancié.
// Un seul triangle est envoyé une fois au GPU ; à chaque image, un tableau donne pour
// chaque véhicule sa position, son orientation, son rayon et ses couleurs, et un seul
// appel de dessin trace tous les véhicules. Le contour est calculé dans le shader.
// Le résultat est rendu dans un canvas hors écran, puis copié dans le canvas p5
// au bon moment de l'image (au-dessus de la fumée, sous les cibles).
const VehicleGL = (() => {
  // par véhicule : x, y, cos, sin, r, remplissage rgb, contour rgb
  const FLOATS = 11;
  // largeur du contour (px CSS), à l'intérieur du triangle
  const STROKE_PX = 1.5;
  // sommets du triangle de Vehicle.show() en rayons, et coordonnées barycentriques
  const CORNERS = new Float32Array([
    -1, -0.5, 1, 0, 0,
    -1, 0.5, 0, 1, 0,
    1, 0, 0, 0, 1,
  ]);

  const VERT = `#version 300 es
in vec2 aCorner;
in vec3 aBary;
in vec4 aPose;      // x, y, cos, sin
in float aRadius;
in vec3 aFill;
in vec3 aStroke;
uniform vec2 uResolution;   // taille de la scène en px CSS
out vec3 vBary;
out vec3 vFill;
out vec3 vStroke;
void main() {
  vec2 local = aCorner * aRadius;
  vec2 world = aPose.xy + vec2(local.x * aPose.z - local.y * aPose.w,
                               local.x * aPose.w + local.y * aPose.z);
  vec2 clip = world / uResolution * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  vBary = aBary;
  vFill = aFill;
  vStroke = aStroke;
}`;

  const FRAG = `#version 300 es
precision highp float;
in vec3 vBary;
in vec3 vFill;
in vec3 vStroke;
uniform float uStroke;      // largeur du contour en pixels de l'écran
out vec4 outColor;
void main() {
  // distance au bord le plus proche, en pixels (dérivées écran des barycentriques)
  vec3 d = vBary / fwidth(vBary);
  float edge = min(min(d.x, d.y), d.z);
  float stroke = 1.0 - smoothstep(uStroke - 0.5, uStroke + 0.5, edge);
  float alpha = clamp(edge + 0.5, 0.0, 1.0);   // bord extérieur adouci
  outColor = vec4(mix(vFill, vStroke, stroke) * alpha, alpha);
}`;

  // '#rrggbb' ou 'rgb(a)(r, g, b[, a])' (formes renvoyées par un contexte Canvas) -> [r, g, b] dans [0, 1]
  function parseCanvasColor(text) {
    if (text[0] === '#' && text.length === 7) {
      return [1, 3, 5].map(i => parseInt(text.slice(i, i + 2), 16) / 255);
    }
    const match = text.match(/rgba?\(([^)]+)\)/);
    if (!match) return [1, 1, 1];
    return match[1].split(',').slice(0, 3).map(v => Number(v) / 255);
  }

  /* Convertisseur de couleurs CSS mis en cache : normalize(couleur) doit renvoyer
     la forme canonique du navigateur (ctx.fillStyle relu après affectation). */
  function colorCache(normalize) {
    const cache = new Map();
    return color => {
      const key = String(color);
      if (!cache.has(key)) cache.set(key, parseCanvasColor(normalize(key)));
      return cache.get(key);
    };
  }

  // remplit data avec les attributs d'instance ; renvoie le nombre de véhicules
  function fillInstances(vehicles, data, toRgb) {
    let o = 0;
    for (const vehicle of vehicles) {
      const [c, s] = VehicleBatch.orientation(vehicle.vel);
      data[o] = vehicle.pos.x;
      data[o + 1] = vehicle.pos.y;
      data[o + 2] = c;
      data[o + 3] = s;
      data[o + 4] = vehicle.r;
      data.set(toRgb(vehicle.fillColor), o + 5);
      data.set(toRgb(vehicle.strokeColor), o + 8);
      o += FLOATS;
    }
    return vehicles.length;
  }

  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }

  // null si WebGL2 n'est pas disponible : la scène utilise alors VehicleBatch
  function create() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: false });
      if (!gl) return null;

      const program = gl.createProgram();
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));

      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const attribute = (name, size, stride, offset, divisor) => {
        const location = gl.getAttribLocation(program, name);
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride * 4, offset * 4);
        gl.vertexAttribDivisor(location, divisor);
      };

      // triangle commun, envoyé une seule fois
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, CORNERS, gl.STATIC_DRAW);
      attribute('aCorner', 2, 5, 0, 0);
      attribute('aBary', 3, 5, 2, 0);

      // attributs par véhicule (divisor 1 : une valeur par instance)
      const instanceBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
      attribute('aPose', 4, FLOATS, 0, 1);
      attribute('aRadius', 1, FLOATS, 4, 1);
      attribute('aFill', 3, FLOATS, 5, 1);
      attribute('aStroke', 3, FLOATS, 8, 1);
      gl.bindVertexArray(null);

      const probe = document.createElement('canvas').getContext('2d');
      const toRgb = colorCache(color => {
        probe.fillStyle = '#000';
        probe.fillStyle = color;
        return probe.fillStyle;
      });

      return {
        canvas, gl, program, vao, instanceBuffer, toRgb,
        data: new Float32Array(FLOATS * 256),
        uResolution: gl.getUniformLocation(program, 'uResolution'),
        uStroke: gl.getUniformLocation(program, 'uStroke'),
      };
    } catch (error) {
      console.warn('Rendu GPU des véhicules indisponible :', error);
      return null;
    }
  }

  /* Dessine les véhicules puis copie le résultat dans ctx (drawingContext de p5).
     w, h : taille de la scène en px CSS ; density : pixelDensity() de p5. */
  function render(state, vehicles, w, h, density, ctx) {
    if (!state || !(w > 0 && h > 0) || vehicles.length === 0) return;
    const { canvas, gl } = state;
    const cw = Math.round(w * density), ch = Math.round(h * density);
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    if (state.data.length < vehicles.length * FLOATS) {
      state.data = new Float32Array(Math.max(vehicles.length, state.data.length / FLOATS * 2) * FLOATS);
    }
    const count = fillInstances(vehicles, state.data, state.toRgb);

    gl.viewport(0, 0, cw, ch);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(state.program);
    gl.uniform2f(state.uResolution, w, h);
    gl.uniform1f(state.uStroke, STROKE_PX * density);
    gl.bindBuffer(gl.ARRAY_BUFFER, state.instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, state.data.subarray(0, count * FLOATS), gl.DYNAMIC_DRAW);
    gl.enable(gl.BLEND);
    // couleurs prémultipliées : chaque véhicule recouvre ceux dessinés avant lui
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(state.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, count);
    gl.bindVertexArray(null);

    ctx.drawImage(canvas, 0, 0, w, h);
  }

  return { FLOATS, STROKE_PX, CORNERS, parseCanvasColor, colorCache, fillInstances, create, render };
})();
