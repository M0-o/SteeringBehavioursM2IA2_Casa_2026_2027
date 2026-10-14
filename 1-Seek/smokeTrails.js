// Effet visuel (pas une entité) : traînées de fumée colorées calculées sur le GPU.
// Le module lit seulement pos, vel, r et maxSpeed des véhicules : aucun effet sur le steering.
//
// WebGL2 direct, dans un canvas hors écran (indépendant de l'état interne de p5).
// Chaque image, avec deux textures en ping-pong (prev, next) :
//   1. les bouffées sont ajoutées à prev (mélange additif), toutes en un seul appel
//      instancié : un triangle par bouffée, arrondi en disque doux par le shader ;
//   2. un shader d'advection relit prev, la déplace dans un champ de flux turbulent,
//      la floute, fait tourner sa teinte et l'atténue, puis écrit le résultat dans next ;
//   3. next est copiée dans le canvas, lui-même copié dans le canvas p5 sous les véhicules,
//      puis prev et next sont échangées.
// La fumée peut être calculée en résolution réduite (scale < 1) : c'est un des leviers
// de la qualité automatique.
const SmokeTrails = (() => {
  const FADE = 0.965;          // part conservée à chaque image (≈ 1 s de traînée à 60 fps)
  const PUFF_SIZE = 12;        // diamètre d'une bouffée à pleine vitesse (px)
  const PUFF_ALPHA = 110 / 255;
  const GOLDEN = 0.618033988749895;
  const SQRT3 = Math.sqrt(3);
  // par bouffée : x, y, rayon (px CSS), r, g, b
  const PUFF_FLOATS = 6;
  // triangle équilatéral circonscrit au disque de rayon 1 (sommets à 2 rayons du centre)
  const PUFF_CORNERS = new Float32Array([0, -2, SQRT3, 1, -SQRT3, 1]);

  const PUFF_VERT = `#version 300 es
in vec2 aCorner;
in vec3 aPuff;      // x, y, rayon
in vec3 aColor;
uniform vec2 uResolution;   // taille de la scène en px CSS
out vec2 vOffset;
out vec3 vColor;
void main() {
  vOffset = aCorner;
  vColor = aColor;
  vec2 world = aPuff.xy + aCorner * aPuff.z;
  vec2 clip = world / uResolution * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`;

  const PUFF_FRAG = `#version 300 es
precision highp float;
in vec2 vOffset;
in vec3 vColor;
uniform float uAlpha;
out vec4 outColor;
void main() {
  // disque de rayon 1 au bord adouci ; couleur prémultipliée pour le mélange additif
  float a = uAlpha * (1.0 - smoothstep(0.4, 1.0, length(vOffset)));
  outColor = vec4(vColor * a, a);
}`;

  // triangle plein écran sans tampon de sommets (gl_VertexID)
  const FULLSCREEN_VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

  const ADVECT_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uPrev;
uniform vec2 uTexSize;      // taille de la texture (pixels)
uniform float uScale;       // pixels de texture par px CSS
uniform float uTime;
uniform float uFade;
out vec4 outColor;

// rotation de teinte autour de l'axe des gris
vec3 hueShift(vec3 c, float a) {
  const vec3 k = vec3(0.57735);
  float ca = cos(a);
  return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca);
}

// champ de flux pseudo-turbulent (somme de sinus) + légère montée de la fumée, en px CSS
vec2 flow(vec2 p, float t) {
  return vec2(sin(p.y * 0.013 + t * 0.7) + 0.5 * sin(p.y * 0.031 - t * 1.3),
              cos(p.x * 0.011 - t * 0.6) + 0.5 * cos(p.x * 0.027 + t * 1.1) + 0.6);
}

void main() {
  vec2 texel = 1.0 / uTexSize;
  vec2 world = gl_FragCoord.xy / uScale;
  // advection semi-lagrangienne : on va chercher la couleur là d'où vient le flux
  vec2 uv = (gl_FragCoord.xy - flow(world, uTime) * 0.8 * uScale) * texel;
  vec4 c = texture(uPrev, uv) * 0.4
         + (texture(uPrev, uv + vec2(texel.x, 0.0)) + texture(uPrev, uv - vec2(texel.x, 0.0))
          + texture(uPrev, uv + vec2(0.0, texel.y)) + texture(uPrev, uv - vec2(0.0, texel.y))) * 0.15;
  c.rgb = max(hueShift(c.rgb, 0.02), 0.0);
  outColor = c * uFade;
}`;

  // HSV (0-1) vers RGB (0-255)
  function hsvToRgb(h, s, v) {
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][((i % 6) + 6) % 6];
    return [r * 255, g * 255, b * 255];
  }

  // Bouffée émise à l'arrière du véhicule, teinte propre à chaque indice, qui dérive dans le temps
  function puffFor(vehicle, index, time) {
    const speed = vehicle.vel.mag();
    const back = speed > 0 ? vehicle.r / speed : 0;
    const ratio = Math.min(speed / vehicle.maxSpeed, 1);
    return {
      x: vehicle.pos.x - vehicle.vel.x * back,
      y: vehicle.pos.y - vehicle.vel.y * back,
      hue: (index * GOLDEN + time * 0.05) % 1,
      size: PUFF_SIZE * (0.5 + 0.5 * ratio),
    };
  }

  // remplit data avec les attributs d'instance des bouffées ; renvoie leur nombre
  function fillPuffInstances(vehicles, data, time) {
    let o = 0;
    vehicles.forEach((vehicle, index) => {
      const puff = puffFor(vehicle, index, time);
      const [r, g, b] = hsvToRgb(puff.hue, 0.85, 1);
      data[o] = puff.x;
      data[o + 1] = puff.y;
      data[o + 2] = puff.size / 2;
      data[o + 3] = r / 255;
      data[o + 4] = g / 255;
      data[o + 5] = b / 255;
      o += PUFF_FLOATS;
    });
    return vehicles.length;
  }

  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }

  function link(gl, vert, frag) {
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vert));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    return program;
  }

  // texture RGBA8 + framebuffer associé, vidés
  function createTarget(gl, w, h) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { texture, framebuffer };
  }

  function deleteTarget(gl, target) {
    gl.deleteTexture(target.texture);
    gl.deleteFramebuffer(target.framebuffer);
  }

  // (re)crée les deux textures si la taille de la fumée change (fenêtre ou résolution)
  function ensureSize(state, w, h, scale) {
    const tw = Math.max(1, Math.round(w * scale)), th = Math.max(1, Math.round(h * scale));
    if (state.tw === tw && state.th === th) return;
    const { gl } = state;
    for (const target of state.targets) deleteTarget(gl, target);
    state.targets = [createTarget(gl, tw, th), createTarget(gl, tw, th)];
    state.canvas.width = tw;
    state.canvas.height = th;
    state.tw = tw;
    state.th = th;
  }

  // null si WebGL2 n'est pas disponible : la scène fonctionne alors sans fumée
  function create(w, h) {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: false, alpha: true });
      if (!gl) return null;
      const puffProgram = link(gl, PUFF_VERT, PUFF_FRAG);
      const advectProgram = link(gl, FULLSCREEN_VERT, ADVECT_FRAG);

      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const attribute = (name, size, stride, offset, divisor) => {
        const location = gl.getAttribLocation(puffProgram, name);
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride * 4, offset * 4);
        gl.vertexAttribDivisor(location, divisor);
      };
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, PUFF_CORNERS, gl.STATIC_DRAW);
      attribute('aCorner', 2, 2, 0, 0);
      const instanceBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
      attribute('aPuff', 3, PUFF_FLOATS, 0, 1);
      attribute('aColor', 3, PUFF_FLOATS, 3, 1);
      gl.bindVertexArray(null);
      // VAO vide pour le triangle plein écran
      const emptyVao = gl.createVertexArray();

      const uniforms = (program, names) => Object.fromEntries(names.map(n => [n, gl.getUniformLocation(program, n)]));
      const state = {
        canvas, gl, puffProgram, advectProgram, vao, emptyVao, instanceBuffer,
        puffUniforms: uniforms(puffProgram, ['uResolution', 'uAlpha']),
        advectUniforms: uniforms(advectProgram, ['uPrev', 'uTexSize', 'uScale', 'uTime', 'uFade']),
        data: new Float32Array(PUFF_FLOATS * 256),
        targets: [], tw: 0, th: 0,
      };
      ensureSize(state, Math.max(w, 1), Math.max(h, 1), 1);
      return state;
    } catch (error) {
      console.warn('Fumée désactivée (WebGL2 indisponible) :', error);
      return null;
    }
  }

  /* w, h : taille courante de la scène (px CSS) ; ctx : drawingContext de p5 ;
     scale : résolution de la fumée (1 = pleine, 0.5 = moitié en largeur et hauteur). */
  function render(state, vehicles, time, w, h, ctx, scale = 1) {
    if (!state || !(w > 0 && h > 0)) return;
    ensureSize(state, w, h, scale);
    const { gl, tw, th } = state;
    const [prev, next] = state.targets;

    // 1. bouffées ajoutées à prev, un seul appel instancié
    if (state.data.length < vehicles.length * PUFF_FLOATS) {
      state.data = new Float32Array(Math.max(vehicles.length, state.data.length / PUFF_FLOATS * 2) * PUFF_FLOATS);
    }
    const count = fillPuffInstances(vehicles, state.data, time);
    gl.viewport(0, 0, tw, th);
    if (count > 0) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, prev.framebuffer);
      gl.useProgram(state.puffProgram);
      gl.uniform2f(state.puffUniforms.uResolution, w, h);
      gl.uniform1f(state.puffUniforms.uAlpha, PUFF_ALPHA);
      gl.bindBuffer(gl.ARRAY_BUFFER, state.instanceBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, state.data.subarray(0, count * PUFF_FLOATS), gl.DYNAMIC_DRAW);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.bindVertexArray(state.vao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, count);
      gl.bindVertexArray(null);
      gl.disable(gl.BLEND);
    }

    // 2. advection + flou + rotation de teinte + atténuation : prev -> next
    gl.bindFramebuffer(gl.FRAMEBUFFER, next.framebuffer);
    gl.useProgram(state.advectProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, prev.texture);
    gl.uniform1i(state.advectUniforms.uPrev, 0);
    gl.uniform2f(state.advectUniforms.uTexSize, tw, th);
    gl.uniform1f(state.advectUniforms.uScale, tw / w);
    gl.uniform1f(state.advectUniforms.uTime, time);
    gl.uniform1f(state.advectUniforms.uFade, FADE);
    gl.bindVertexArray(state.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);

    // 3. next -> canvas -> canvas p5, puis échange
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, next.framebuffer);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    gl.blitFramebuffer(0, 0, tw, th, 0, 0, tw, th, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    state.targets = [next, prev];
    ctx.drawImage(state.canvas, 0, 0, w, h);
  }

  // la taille de la fumée suit la scène (et la résolution choisie) à chaque render
  return { FADE, PUFF_SIZE, PUFF_FLOATS, PUFF_CORNERS, hsvToRgb, puffFor, fillPuffInstances, create, render };
})();
