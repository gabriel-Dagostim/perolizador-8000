/* Perolizador 8000 - visualizador 3D e animação
   three.js r147 local (vendor/). Coordenadas em mm, Z para cima, dentro de um Group
   girado -90° em X (mundo com Y para cima). Borda do pote em z = 4. */
(function () {
  'use strict';

  // r147: cores hex passam a ser tratadas como sRGB (convertidas para linear)
  if (window.THREE && THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;

  var $ = function (id) { return document.getElementById(id); };
  var clamp = function (x, a, b) { return Math.min(b === undefined ? 1 : b, Math.max(a === undefined ? 0 : a, x)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var smooth = function (x) { x = clamp(x); return x * x * (3 - 2 * x); };
  var rad = function (d) { return d * Math.PI / 180; };
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DARKQ = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  /* ---------------------------------------------------------------- */
  /* Geometria de referência                                           */
  /* ---------------------------------------------------------------- */
  var NOZ = [];
  (function () {
    var k, a;
    for (k = 0; k < 4; k++) { a = rad(45 + 90 * k); NOZ.push([7 * Math.cos(a), 7 * Math.sin(a)]); }
    for (k = 0; k < 9; k++) { a = rad(40 * k); NOZ.push([16.5 * Math.cos(a), 16.5 * Math.sin(a)]); }
  })();

  var GEL_TOP = 1;          // 3 mm abaixo da boca (z=4)
  var TIP0 = -25;           // ponta dos bicos na camada 1 (z)
  var PEARL_R = 4;
  var Z_LUER_TOP = 44.3;

  var JAR_PROFILE = [
    [0, -36], [26, -36], [29.3, -35], [30, -33.5], [30, -12.5], [27.5, -11], [27.5, 4],
    [24.5, 4], [24.5, -11], [27, -13], [27, -29.6], [26.1, -30.7], [25, -31], [0, -31]
  ];
  var GEL_PROFILE = [
    [0, -30.9], [25, -30.9], [26.1, -30.6], [26.9, -29.6], [26.9, -13], [24.4, -11], [24.4, 3.9]
  ];

  /* ---------------------------------------------------------------- */
  /* Utilidades three                                                  */
  /* ---------------------------------------------------------------- */
  function lathe(pts, seg) {
    var g = new THREE.LatheGeometry(pts.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), seg || 64);
    g.rotateX(Math.PI / 2);
    return g;
  }
  function zCyl(rt, rb, h, seg, open) {
    var g = new THREE.CylinderGeometry(rt, rb, h, seg || 32, 1, !!open);
    g.rotateX(Math.PI / 2);
    return g;
  }

  // normais suaves com ângulo de vinco (STL vem com normais planas)
  function smoothNormals(geo, angleDeg) {
    var pos = geo.attributes.position.array;
    var n = pos.length / 9;
    var un = new Float32Array(n * 3), area = new Float32Array(n);
    var map = new Map();
    var keys = new Array(n * 3);
    var f, c, i, a, b, cx, cy, cz, len;
    function key(o) {
      return Math.round(pos[o] * 500) + ',' + Math.round(pos[o + 1] * 500) + ',' + Math.round(pos[o + 2] * 500);
    }
    for (f = 0; f < n; f++) {
      i = f * 9;
      var ux = pos[i + 3] - pos[i], uy = pos[i + 4] - pos[i + 1], uz = pos[i + 5] - pos[i + 2];
      var vx = pos[i + 6] - pos[i], vy = pos[i + 7] - pos[i + 1], vz = pos[i + 8] - pos[i + 2];
      cx = uy * vz - uz * vy; cy = uz * vx - ux * vz; cz = ux * vy - uy * vx;
      len = Math.sqrt(cx * cx + cy * cy + cz * cz);
      area[f] = len;
      if (len > 1e-12) { un[f * 3] = cx / len; un[f * 3 + 1] = cy / len; un[f * 3 + 2] = cz / len; }
      for (c = 0; c < 3; c++) {
        var k = key(i + c * 3);
        keys[f * 3 + c] = k;
        var l = map.get(k);
        if (!l) { l = []; map.set(k, l); }
        l.push(f);
      }
    }
    var cosT = Math.cos(rad(angleDeg));
    var out = new Float32Array(n * 9);
    for (f = 0; f < n; f++) {
      for (c = 0; c < 3; c++) {
        var list = map.get(keys[f * 3 + c]);
        var sx = 0, sy = 0, sz = 0;
        for (a = 0; a < list.length; a++) {
          b = list[a];
          var d = un[f * 3] * un[b * 3] + un[f * 3 + 1] * un[b * 3 + 1] + un[f * 3 + 2] * un[b * 3 + 2];
          if (b === f || d >= cosT) { sx += un[b * 3] * area[b]; sy += un[b * 3 + 1] * area[b]; sz += un[b * 3 + 2] * area[b]; }
        }
        len = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1;
        var o = f * 9 + c * 3;
        out[o] = sx / len; out[o + 1] = sy / len; out[o + 2] = sz / len;
      }
    }
    geo.setAttribute('normal', new THREE.BufferAttribute(out, 3));
  }

  /* ---------------------------------------------------------------- */
  /* Carregamento dos modelos (uma vez, compartilhado)                 */
  /* ---------------------------------------------------------------- */
  var MODEL_FILES = ['cabecote', 'bico', 'anel', 'adaptador_luer', 'adaptador_cateter', 'adaptador_grosso'];
  var modelsPromise = null, modelsLoaded = 0, progressCbs = [];
  function loadModels(onProgress) {
    if (onProgress) { progressCbs.push(onProgress); onProgress(modelsLoaded); }
    if (!modelsPromise) {
      var loader = new THREE.STLLoader();
      modelsPromise = Promise.all(MODEL_FILES.map(function (name) {
        return new Promise(function (resolve, reject) {
          loader.load('modelos/web_' + name + '.stl', function (g) {
            smoothNormals(g, 38);
            g.computeBoundingSphere();
            modelsLoaded++;
            progressCbs.forEach(function (f) { f(modelsLoaded); });
            resolve([name, g]);
          }, undefined, function () {
            reject(new Error('Não foi possível carregar o modelo ' + name + '.'));
          });
        });
      })).then(function (arr) {
        var o = {};
        arr.forEach(function (p) { o[p[0]] = p[1]; });
        return o;
      });
    }
    return modelsPromise;
  }

  /* ---------------------------------------------------------------- */
  /* Palco (renderer, cena, câmera, laço sob demanda)                  */
  /* ---------------------------------------------------------------- */
  function Stage(host) {
    var self = this;
    this.host = host;
    this.canvas = host.querySelector('canvas');
    var r;
    try {
      r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (e) {
      throw new Error('Este navegador ou aparelho não tem WebGL disponível.');
    }
    this.renderer = r;
    this.low = (window.devicePixelRatio > 2 && window.innerWidth < 700) || !r.capabilities.isWebGL2;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputEncoding = THREE.sRGBEncoding;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.88;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.localClippingEnabled = true;
    r.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1.6, 5, 3000);
    this.camera.position.set(120, 90, 230);
    this.cutPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 1e4);

    // ambiente para reflexos
    var envOk = false;
    if (THREE.RoomEnvironment && THREE.PMREMGenerator) {
      try {
        var pm = new THREE.PMREMGenerator(r);
        this.scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
        pm.dispose();
        envOk = true;
      } catch (e2) { envOk = false; }
    }
    var hemi = new THREE.HemisphereLight(0xdfe8f5, 0x8a93a1, envOk ? 0.25 : 0.9);
    this.scene.add(hemi);
    var key = new THREE.DirectionalLight(0xffffff, envOk ? 1.5 : 2.2);
    key.position.set(150, 380, 230);
    key.castShadow = true;
    var ss = this.low ? 1024 : 2048;
    key.shadow.mapSize.set(ss, ss);
    var sc = key.shadow.camera;
    sc.left = -175; sc.right = 175; sc.top = 175; sc.bottom = -175; sc.near = 60; sc.far = 900;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.6;
    key.shadow.radius = 4;
    this.scene.add(key);
    var rim = new THREE.DirectionalLight(0xaec4ff, 0.5);
    rim.position.set(-220, 140, -160);
    this.scene.add(rim);

    // bancada: esteira de corte com grade de 10/50 mm + sombra
    this.gridTex = new THREE.CanvasTexture(document.createElement('canvas'));
    this.gridTex.encoding = THREE.sRGBEncoding;
    this.gridTex.anisotropy = 4;
    this.paintGrid();
    var bench = new THREE.Group();
    bench.rotation.x = -Math.PI / 2;
    var mat = new THREE.Mesh(new THREE.PlaneGeometry(440, 440),
      new THREE.MeshBasicMaterial({ map: this.gridTex, transparent: true, depthWrite: false, toneMapped: false }));
    mat.position.z = -36.04;
    mat.renderOrder = -2;
    var sh = new THREE.Mesh(new THREE.PlaneGeometry(440, 440), new THREE.ShadowMaterial({ opacity: DARKQ && DARKQ.matches ? 0.5 : 0.28 }));
    sh.position.z = -36.02;
    sh.receiveShadow = true;
    sh.renderOrder = -1;
    this.shadowMat = sh.material;
    bench.add(mat, sh);
    this.scene.add(bench);

    this.controls = new THREE.OrbitControls(this.camera, this.canvas);
    var c = this.controls;
    c.enableDamping = true;
    c.dampingFactor = 0.09;
    c.minDistance = 70;
    c.maxDistance = 760;
    c.maxPolarAngle = Math.PI * 0.53;
    c.rotateSpeed = 0.8;
    c.screenSpacePanning = false;
    c.autoRotateSpeed = 1.6;
    // permite rolar a página com um dedo na vertical
    this.canvas.style.touchAction = 'pan-y';
    c.addEventListener('change', function () { self.request(); });

    this.visible = true;
    this.onFrame = null;
    this.afterRender = null;
    this._raf = 0;
    this._last = 0;

    if (window.IntersectionObserver) {
      new IntersectionObserver(function (es) {
        self.visible = es[0].isIntersecting;
        if (self.visible) { self._last = 0; self.request(); }
      }, { rootMargin: '80px' }).observe(host);
    }
    if (window.ResizeObserver) new ResizeObserver(function () { self.resize(); }).observe(host);
    else window.addEventListener('resize', function () { self.resize(); });
    var onTheme = function () {
      self.paintGrid();
      self.shadowMat.opacity = DARKQ && DARKQ.matches ? 0.5 : 0.28;
      self.request();
    };
    if (DARKQ) { if (DARKQ.addEventListener) DARKQ.addEventListener('change', onTheme); else if (DARKQ.addListener) DARKQ.addListener(onTheme); }
    this.canvas.addEventListener('webglcontextlost', function (ev) {
      ev.preventDefault();
      showError(host, 'O contexto 3D foi perdido (pouca memória de vídeo). Recarregue a página.');
    });
    this.resize();
  }
  Stage.prototype.paintGrid = function () {
    var dark = !!(DARKQ && DARKQ.matches);
    var c = this.gridTex.image, S = 1024, ppm = S / 440, g;
    c.width = S; c.height = S;
    g = c.getContext('2d');
    g.clearRect(0, 0, S, S);
    var minor = dark ? 'rgba(150,175,235,.13)' : 'rgba(31,79,191,.15)';
    var major = dark ? 'rgba(150,175,235,.30)' : 'rgba(31,79,191,.34)';
    var i, p;
    for (i = -22; i <= 22; i++) {
      p = S / 2 + i * 10 * ppm;
      g.strokeStyle = i % 5 === 0 ? major : minor;
      g.lineWidth = i % 5 === 0 ? 2.2 : 1.2;
      g.beginPath(); g.moveTo(p, 0); g.lineTo(p, S); g.stroke();
      g.beginPath(); g.moveTo(0, p); g.lineTo(S, p); g.stroke();
    }
    g.globalCompositeOperation = 'destination-in';
    var gr = g.createRadialGradient(S / 2, S / 2, S * 0.06, S / 2, S / 2, S / 2);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.55, 'rgba(0,0,0,.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    g.globalCompositeOperation = 'source-over';
    this.gridTex.needsUpdate = true;
  };
  Stage.prototype.resize = function () {
    var w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.request();
  };
  Stage.prototype.request = function () {
    var self = this;
    if (this._raf || !this.visible) return;
    this._raf = requestAnimationFrame(function (now) { self.tick(now); });
  };
  Stage.prototype.tick = function (now) {
    this._raf = 0;
    if (!this.visible) return;
    var dt = this._last ? Math.min(0.1, (now - this._last) / 1000) : 0.016;
    this._last = now;
    var more = false;
    if (this.onFrame) more = !!this.onFrame(dt);
    var moved = this.controls.update();
    this.renderer.render(this.scene, this.camera);
    if (this.afterRender) this.afterRender();
    if (more || moved || this.controls.autoRotate) this.request();
    else this._last = 0;
  };
  // posiciona a câmera: azimute/elevação em graus, distância e z do alvo (coordenadas locais)
  Stage.prototype.setShot = function (az, el, d, tz) {
    var a = rad(az), e = rad(el);
    this.controls.target.set(0, tz, 0);
    this.camera.position.set(
      d * Math.sin(a) * Math.cos(e),
      tz + d * Math.sin(e),
      d * Math.cos(a) * Math.cos(e)
    );
  };

  function showError(host, msg) {
    var ld = host.querySelector('[data-ov="loading"]'), er = host.querySelector('[data-ov="error"]');
    if (ld) ld.hidden = true;
    if (er) { er.hidden = false; er.querySelector('.ov-t').textContent = msg; }
  }
  function hideLoading(host) {
    var ld = host.querySelector('[data-ov="loading"]');
    if (ld) ld.hidden = true;
  }

  /* ---------------------------------------------------------------- */
  /* Materiais                                                         */
  /* ---------------------------------------------------------------- */
  function makeMats(low, cut, gelPlane) {
    var cp = [cut];
    var m = {};
    m.petg = new THREE.MeshStandardMaterial({ color: 0x1d1f22, roughness: 0.55, metalness: 0, envMapIntensity: 1.35, clippingPlanes: cp });
    m.noz = new THREE.MeshStandardMaterial({ color: 0x30343b, roughness: 0.5, metalness: 0, envMapIntensity: 1.3, clippingPlanes: cp });
    m.ring = new THREE.MeshStandardMaterial({ color: 0x25282d, roughness: 0.55, metalness: 0, envMapIntensity: 1.3, clippingPlanes: cp });
    m.adapt = new THREE.MeshStandardMaterial({ color: 0x1b2640, roughness: 0.5, metalness: 0, envMapIntensity: 1.4, clippingPlanes: cp });
    m.cutface = new THREE.MeshBasicMaterial({ color: 0x2a5bd7, side: THREE.BackSide, clippingPlanes: cp });
    // vidro: transparente (não transmissivo) para o gel e as pérolas continuarem visíveis por dentro
    var glassOpts = {
      color: 0xd6e6f4, roughness: 0.05, metalness: 0, ior: 1.5, thickness: 2,
      transparent: true, opacity: low ? 0.16 : 0.2, depthWrite: false, envMapIntensity: 2.2,
      clearcoat: low ? 0 : 1, clearcoatRoughness: 0.03, clippingPlanes: cp
    };
    var Glass = low ? THREE.MeshStandardMaterial : THREE.MeshPhysicalMaterial;
    var go = Object.assign({}, glassOpts);
    if (low) { delete go.ior; delete go.thickness; delete go.clearcoat; delete go.clearcoatRoughness; }
    m.glassF = new Glass(Object.assign({ side: THREE.FrontSide }, go));
    m.glassB = new Glass(Object.assign({ side: THREE.BackSide }, go));
    var gelOpts = {
      color: 0xbcd9ee, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.4,
      depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.4, clippingPlanes: [cut, gelPlane]
    };
    m.gel = low ? new THREE.MeshStandardMaterial(gelOpts) : new THREE.MeshPhysicalMaterial(Object.assign({ clearcoat: 0.6, clearcoatRoughness: 0.1 }, gelOpts));
    m.gelTop = m.gel.clone(); m.gelTop.clippingPlanes = cp;
    var pearlOpts = { color: 0xe6ebb0, emissive: 0x2e310c, roughness: 0.2, metalness: 0, envMapIntensity: 0.8, clippingPlanes: cp };
    m.pearl = low
      ? new THREE.MeshStandardMaterial(Object.assign({ transparent: true, opacity: 0.92 }, pearlOpts))
      : new THREE.MeshPhysicalMaterial(Object.assign({ transmission: 0.3, thickness: 3, ior: 1.4, clearcoat: 0.7, clearcoatRoughness: 0.1 }, pearlOpts));
    m.gold = new THREE.MeshStandardMaterial({ color: 0xd8b04a, metalness: 1, roughness: 0.25, envMapIntensity: 1.6, clippingPlanes: cp });
    m.syrGlass = new Glass(Object.assign({ side: THREE.FrontSide }, go, { opacity: low ? 0.18 : 0.22 }));
    m.syrGel = new THREE.MeshStandardMaterial({ color: 0xe6ebb0, emissive: 0x2e310c, roughness: 0.25, metalness: 0, transparent: true, opacity: 0.92, depthWrite: false, envMapIntensity: 0.8, clippingPlanes: cp });
    m.rubber = new THREE.MeshStandardMaterial({ color: 0x25272b, roughness: 0.7, clippingPlanes: cp });
    m.white = new THREE.MeshStandardMaterial({ color: 0xf0f3f7, roughness: 0.4, envMapIntensity: 1.2, clippingPlanes: cp });
    return m;
  }

  function gradTexture() {
    var c = document.createElement('canvas');
    c.width = 256; c.height = 1024;
    var g = c.getContext('2d');
    g.strokeStyle = '#1a2330'; g.fillStyle = '#1a2330';
    g.lineWidth = 3.5; g.font = 'bold 34px sans-serif'; g.textBaseline = 'middle';
    var mmPerMl = 1000 / 616, ml, y, len;
    for (ml = 1; ml <= 60; ml++) {
      y = 1024 * (1 - (ml * mmPerMl) / 100);
      len = ml % 10 === 0 ? 120 : (ml % 5 === 0 ? 84 : 48);
      g.beginPath(); g.moveTo(20, y); g.lineTo(20 + len, y); g.stroke();
      if (ml % 10 === 0) g.fillText(String(ml), 20 + len + 12, y);
    }
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    return t;
  }

  /* ---------------------------------------------------------------- */
  /* Rig: todas as peças                                               */
  /* ---------------------------------------------------------------- */
  var DROPS = null;
  function dropGeos() {
    if (DROPS) return DROPS;
    DROPS = [];
    for (var q = 0; q <= 4; q++) {
      var k = q / 4 * 0.75, pts = [], N = 28, i, th, h, r;
      for (i = 0; i <= N; i++) {
        th = Math.PI * i / N;
        h = Math.cos(th); r = Math.sin(th);
        if (h > 0) { r *= 1 - k * 0.55 * Math.pow(h, 1.3); h *= 1 + k * 0.45; }
        pts.push([Math.max(r, 0.0001), h]);
      }
      pts.reverse();
      DROPS.push(lathe(pts, 32));
    }
    return DROPS;
  }

  function buildSyringe(M) {
    var g = new THREE.Group();
    var tip = new THREE.Mesh(zCyl(2.15, 2.0, 8, 24), M.syrGlass);
    tip.position.z = 4; tip.renderOrder = 3;
    var barrel = new THREE.Mesh(lathe([[3.4, 8], [14.65, 14], [14.65, 114], [14.15, 114], [14.15, 14], [2.8, 8]], 64), M.syrGlass);
    barrel.renderOrder = 3;
    var ears = new THREE.Mesh(zCyl(21, 21, 2.2, 40), M.syrGlass);
    ears.scale.y = 0.55; ears.position.z = 113; ears.renderOrder = 3;
    var gradGeo = new THREE.CylinderGeometry(14.7, 14.7, 100, 24, 1, true, -0.55, 1.1);
    gradGeo.rotateX(Math.PI / 2);
    var grad = new THREE.Mesh(gradGeo, new THREE.MeshBasicMaterial({ map: gradTexture(), transparent: true, depthWrite: false, side: THREE.FrontSide }));
    grad.position.z = 64; grad.renderOrder = 4;

    var gelTip = new THREE.Mesh(zCyl(1.1, 1.1, 8, 12), M.syrGel); gelTip.position.z = 4; gelTip.renderOrder = 1;
    var gelCone = new THREE.Mesh(zCyl(13.9, 2, 6.2, 48), M.syrGel); gelCone.position.z = 11; gelCone.renderOrder = 1;
    var cylGeo = zCyl(13.9, 13.9, 1, 48); cylGeo.translate(0, 0, 0.5);
    var gelCyl = new THREE.Mesh(cylGeo, M.syrGel); gelCyl.position.z = 14; gelCyl.renderOrder = 1;

    var stopper = new THREE.Mesh(zCyl(14.0, 14.0, 10, 48), M.rubber); stopper.castShadow = true;
    var rodGeoA = new THREE.BoxGeometry(2.2, 22, 96), rodGeoB = new THREE.BoxGeometry(22, 2.2, 96);
    var rodA = new THREE.Mesh(rodGeoA, M.white), rodB = new THREE.Mesh(rodGeoB, M.white);
    var rod = new THREE.Group(); rod.add(rodA, rodB); rodA.castShadow = rodB.castShadow = true;
    var thumb = new THREE.Mesh(zCyl(19, 19, 2.5, 40), M.white); thumb.castShadow = true;

    g.add(tip, barrel, ears, grad, gelTip, gelCone, gelCyl, stopper, rod, thumb);
    g.userData.setPlunger = function (pl) {
      pl = Math.max(0.01, pl);
      gelCyl.scale.z = pl;
      stopper.position.z = 14 + pl + 5;
      rod.position.z = 14 + pl + 10 + 48;
      thumb.position.z = 14 + pl + 10 + 96 + 1.25;
    };
    g.userData.setPlunger(58);
    g.traverse(function (o) { o.frustumCulled = false; });
    return g;
  }

  function buildCap(M) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(lathe([[28.4, 0], [29.6, 0], [30, 0.5], [30, 12.6], [29.1, 14], [0, 14], [0, 12], [28.4, 12], [28.4, 0]], 96), M.gold);
    body.castShadow = true;
    var N = 48, ridges = new THREE.InstancedMesh(new THREE.BoxGeometry(1.0, 1.7, 10.4), M.gold, N), mtx = new THREE.Matrix4(), i, a;
    var q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
    for (i = 0; i < N; i++) {
      a = i / N * Math.PI * 2;
      q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), a);
      p.set(30.15 * Math.cos(a), 30.15 * Math.sin(a), 6.4);
      mtx.compose(p, q, s);
      ridges.setMatrixAt(i, mtx);
    }
    ridges.castShadow = true;
    g.add(body, ridges);
    g.traverse(function (o) { o.frustumCulled = false; });
    return g;
  }

  function buildRig(models, stage, opts) {
    var low = stage.low;
    var gelPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), GEL_TOP);
    var M = makeMats(low, stage.cutPlane, gelPlane);
    var root = new THREE.Group();
    root.rotation.x = -Math.PI / 2;
    var backs = [];
    function cast(o) { o.castShadow = true; o.frustumCulled = false; return o; }
    function addBack(mesh) {
      var b = new THREE.Mesh(mesh.geometry, M.cutface);
      b.visible = false; b.frustumCulled = false;
      mesh.add(b); backs.push(b);
    }
    var rig = { root: root, M: M, nozXY: NOZ };

    // pote
    var jarGeo = lathe(JAR_PROFILE, 96);
    var jarB = new THREE.Mesh(jarGeo, M.glassB); jarB.renderOrder = 0;
    var jarF = new THREE.Mesh(jarGeo, M.glassF); jarF.renderOrder = 3;
    root.add(jarB, jarF);
    [-7.5, -4, -0.5].forEach(function (z) {
      var t = new THREE.Mesh(new THREE.TorusGeometry(27.5, 0.7, 8, 96), M.glassF);
      t.position.z = z; t.renderOrder = 3; root.add(t);
    });

    // gel base
    var gel = new THREE.Mesh(lathe(GEL_PROFILE, 80), M.gel); gel.renderOrder = 1;
    var gelDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 80), M.gelTop); gelDisc.renderOrder = 1;
    root.add(gel, gelDisc);
    rig.setGel = function (L) {
      gelPlane.constant = L;
      var on = L > -30.8;
      gel.visible = gelDisc.visible = on;
      var r = L > -11 ? 24.4 : (L < -13 ? 26.9 : lerp(26.9, 24.4, (L + 13) / 2));
      gelDisc.scale.set(r, r, 1);
      gelDisc.position.z = L;
    };

    // cabeçote + bicos
    var headGroup = new THREE.Group(); root.add(headGroup);
    var head = cast(new THREE.Mesh(models.cabecote, M.petg)); headGroup.add(head); addBack(head);
    var nozGroup = new THREE.Group(); headGroup.add(nozGroup);
    var noz = new THREE.InstancedMesh(models.bico, M.noz, 13);
    var nozB = new THREE.InstancedMesh(models.bico, M.cutface, 13);
    var mt = new THREE.Matrix4();
    NOZ.forEach(function (p, i) { mt.makeTranslation(p[0], p[1], 4); noz.setMatrixAt(i, mt); nozB.setMatrixAt(i, mt); });
    cast(noz); nozB.frustumCulled = false; nozB.visible = false; backs.push(nozB);
    nozGroup.add(noz, nozB);
    rig.headGroup = headGroup; rig.nozGroup = nozGroup;

    // adaptadores
    var adGroup = new THREE.Group(); root.add(adGroup);
    rig.adapters = {};
    ['luer', 'cateter', 'grosso'].forEach(function (n) {
      var a = cast(new THREE.Mesh(models['adaptador_' + n], M.adapt));
      a.visible = n === 'luer'; adGroup.add(a); addBack(a); rig.adapters[n] = a;
    });
    rig.adGroup = adGroup;

    // anéis
    rig.rings = [0, 1].map(function (n) {
      var g = new THREE.Group();
      var m = cast(new THREE.Mesh(models.anel, M.ring)); g.add(m); addBack(m);
      g.position.z = 8 * n; g.visible = false; root.add(g);
      return g;
    });

    // pérolas (3 camadas x 13)
    var geos = dropGeos();
    rig.pearls = [0, 1, 2].map(function () {
      return NOZ.map(function (p) {
        var m = new THREE.Mesh(geos[0], M.pearl);
        m.castShadow = !low; m.frustumCulled = false; m.visible = false;
        m.position.x = p[0]; m.position.y = p[1];
        root.add(m);
        return m;
      });
    });
    // r: raio (mm), q: 0 (esfera) a 4 (gota presa ao bico)
    rig.setPearls = function (l, r, q) {
      var tip = TIP0 + 8 * l, list = rig.pearls[l], on = r > 0.05, i, m, k = q / 4 * 0.75;
      for (i = 0; i < 13; i++) {
        m = list[i];
        if (m.visible !== on) m.visible = on;
        if (!on) continue;
        m.scale.setScalar(r);
        m.position.z = tip - 0.2 * r - 0.25 * r * k;
        if (m.userData.q !== q) { m.geometry = geos[q]; m.userData.q = q; }
      }
    };

    // seringa e tampa (só na animação)
    if (opts && opts.syringe) {
      rig.syringe = buildSyringe(M); rig.syringe.visible = false; root.add(rig.syringe);
      rig.cap = buildCap(M); rig.cap.visible = false; root.add(rig.cap);
    }

    rig.setCut = function (on) {
      stage.cutPlane.constant = on ? 0 : 1e4;
      backs.forEach(function (b) { b.visible = on; });
    };
    stage.scene.add(root);
    return rig;
  }

  /* ---------------------------------------------------------------- */
  /* Viewer 1: explorador                                              */
  /* ---------------------------------------------------------------- */
  function initExplorer() {
    var host = $('stage1');
    var stage, rig;
    var LEG = [
      'Camada 1: cabeçote assentado direto na boca do pote.',
      'Camada 2: anel 1 entre o pote e o cabeçote, que sobe 8 mm. As 13 pérolas da camada 1 ficam no gel.',
      'Camada 3: anéis 1 e 2 empilhados, cabeçote 16 mm mais alto. 26 pérolas já estão no gel.'
    ];
    var hs = {}, hsLayer = $('hs-layer');
    host.querySelectorAll('.hs').forEach(function (el) { hs[el.getAttribute('data-hs')] = el; });
    var v = new THREE.Vector3();

    function read() {
      return {
        e: (+$('explodir').value) / 100,
        layer: +document.querySelector('input[name="camada"]:checked').value,
        adapter: document.querySelector('input[name="adapt"]:checked').value,
        cut: $('corte').checked
      };
    }
    function pose(st) {
      var k = st.layer - 1, e = st.e, i;
      var headZ = 8 * k + e * (14 * k + 34);
      rig.headGroup.position.z = headZ;
      rig.nozGroup.position.z = -12 * e;
      var adZ = headZ + e * 40;
      rig.adGroup.position.z = adZ;
      for (var n in rig.adapters) rig.adapters[n].visible = n === st.adapter;
      for (i = 0; i < 2; i++) {
        rig.rings[i].visible = i < k;
        rig.rings[i].position.z = 8 * i + e * 14 * (i + 1);
      }
      for (i = 0; i < 3; i++) rig.setPearls(i, i < k ? PEARL_R : 0, 0);
      rig.setCut(st.cut);
      var top = { luer: 44.3, cateter: 52.3, grosso: 54.3 }[st.adapter];
      st.pts = {
        cabecote: [0, -31, headZ + 18],
        adaptador: [10.5, 0, adZ + (17 + top) / 2],
        bicos: [16.5, 0, headZ - 12 * e - 12],
        anel: [0, -31, rig.rings[0].position.z + 6],
        pote: [0, -30, -22]
      };
      st.tz = 8 + 5 * k + e * (18 + 6 * k);
    }
    var cur = null;
    function apply() {
      cur = read();
      pose(cur);
      $('explodir-out').textContent = Math.round(cur.e * 100) + '%';
      $('explodir').setAttribute('aria-valuetext', Math.round(cur.e * 100) + '%');
      $('legenda-v1').textContent = LEG[cur.layer - 1];
      hs.anel.toggleAttribute('data-off', cur.layer < 2);
      stage.request();
    }
    function updateHotspots() {
      if (!cur || hsLayer.classList.contains('off')) return;
      var w = host.clientWidth, h = host.clientHeight, key, p, el;
      for (key in hs) {
        el = hs[key]; p = cur.pts[key];
        if (el.hasAttribute('data-off')) continue;
        v.set(p[0], p[1], p[2]);
        rig.root.localToWorld(v);
        v.project(stage.camera);
        var x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
        el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
        el.style.visibility = (v.z > 1 || x < 0 || x > w || y < 0 || y > h) ? 'hidden' : '';
      }
    }

    loadModels(function (n) {
      var t = host.querySelector('[data-ov="loading"] .ov-t');
      if (t) t.textContent = 'Carregando modelos 3D… ' + n + '/' + MODEL_FILES.length;
    }).then(function (models) {
      stage = new Stage(host);
      rig = buildRig(models, stage, {});
      rig.setGel(GEL_TOP);
      stage.setShot(28, 20, 255, 10);
      stage.controls.target.y = 10;
      var wantTz = function () { return cur ? cur.tz : 10; };
      stage.onFrame = function (dt) {
        var d = wantTz() - stage.controls.target.y;
        if (Math.abs(d) > 0.05) {
          var s = d * Math.min(1, dt * 7);
          stage.controls.target.y += s; stage.camera.position.y += s;
          return true;
        }
        return false;
      };
      stage.afterRender = updateHotspots;

      document.querySelectorAll('#explodir, input[name="camada"], input[name="adapt"], #corte').forEach(function (el) {
        el.addEventListener('input', apply);
        el.addEventListener('change', apply);
      });
      $('rotulos').addEventListener('change', function () {
        hsLayer.classList.toggle('off', !this.checked);
        stage.request();
      });
      var gir = $('girar');
      function setSpin(on) {
        stage.controls.autoRotate = on && !REDUCED;
        gir.checked = on && !REDUCED;
        stage.request();
      }
      gir.addEventListener('change', function () { setSpin(gir.checked); });
      stage.controls.addEventListener('start', function () { if (gir.checked) setSpin(false); });
      if (REDUCED) { gir.title = 'Desativado por preferência de movimento reduzido do sistema'; }

      apply();
      hideLoading(host);
      stage.request();
      // gancho de depuração/captura (não usado pelo site): câmera e render determinísticos
      window.__p8000 = window.__p8000 || {};
      window.__p8000.hero = {
        stage: stage, rig: rig,
        shot: function (az, el, d, tz) {
          cur.tz = tz;
          stage.controls.minDistance = 20; stage.controls.maxPolarAngle = Math.PI;
          stage.setShot(az, el, d, tz);
          stage.controls.update();
          stage.renderer.render(stage.scene, stage.camera);
          updateHotspots();
        }
      };
    }).catch(function (err) {
      showError(host, 'Não foi possível exibir o 3D: ' + (err && err.message ? err.message : 'erro desconhecido') + ' Veja as imagens e baixe os arquivos mesmo assim.');
    });
  }

  /* ---------------------------------------------------------------- */
  /* Viewer 2: animação (função pura do tempo)                         */
  /* ---------------------------------------------------------------- */
  var L2 = 20.5, L3 = 28.5, H = 36.5, END = 47.5;
  var CAMMUL = 1; // só muda pelo gancho de captura (formato vertical)

  // chaves [t, valor, 'l'?]; 'l' = intervalo linear que termina nessa chave; padrão = suavizado
  function track(t, keys) {
    if (t <= keys[0][0]) return keys[0][1];
    for (var i = 1; i < keys.length; i++) {
      var k = keys[i], p = keys[i - 1];
      if (t <= k[0]) {
        if (k[0] === p[0]) return k[1];
        var u = (t - p[0]) / (k[0] - p[0]);
        return lerp(p[1], k[1], k[2] === 'l' ? u : smooth(u));
      }
    }
    return keys[keys.length - 1][1];
  }

  var K = {
    gel: [[0, -31], [0.8, -31], [4.2, GEL_TOP]],
    headX: [[0, 170], [4.5, 170], [6.3, 0], [H + 1.8, 0], [H + 2.6, 170]],
    headZ: [[0, 50], [9, 50], [12.3, 0],
      [L2 + 0.8, 0], [L2 + 1.9, 30], [L2 + 3.2, 30], [L2 + 4.3, 8],
      [L3 + 0.8, 8], [L3 + 1.9, 38], [L3 + 3.2, 38], [L3 + 4.3, 16],
      [H + 0.6, 16], [H + 1.8, 60]],
    adLift: [[0, 26], [6.3, 26], [9, 0]],
    adRot: [[0, 0], [6.3, 0], [9, Math.PI / 2]],
    syZ: [[0, 235], [12.5, 235], [16, 36.3],
      [L2, 36.3], [L2 + 1, 100], [L2 + 4.3, 100], [L2 + 5.5, 44.3],
      [L3, 44.3], [L3 + 1, 108], [L3 + 4.3, 108], [L3 + 5.5, 52.3],
      [H, 52.3], [H + 1.5, 240]],
    pl: [[0, 58], [16.6, 58], [19.7, 52, 'l'], [L2 + 5.5, 52], [L2 + 7.3, 46, 'l'], [L3 + 5.5, 46], [L3 + 7.3, 40, 'l']],
    ring0X: [[0, 160], [L2 + 1.9, 160], [L2 + 2.7, 0], [H + 3.2, 0], [H + 4.0, -170]],
    ring0Z: [[0, 14], [L2 + 2.7, 14], [L2 + 3.2, 0], [H + 2.6, 0], [H + 3.2, 32]],
    ring1X: [[0, 160], [L3 + 1.9, 160], [L3 + 2.7, 0], [H + 2.4, 0], [H + 3.2, -170]],
    ring1Z: [[0, 22], [L3 + 2.7, 22], [L3 + 3.2, 8], [H + 1.8, 8], [H + 2.4, 40]],
    capZ: [[H + 3.6, 70], [H + 5.2, 10], [H + 7.0, -8, 'l']],
    capRot: [[H + 3.6, 0], [H + 5.2, 0], [H + 7.0, Math.PI * 4, 'l']]
  };
  var GROW = [[16.6, 19.7], [L2 + 5.5, L2 + 7.3], [L3 + 5.5, L3 + 7.3]];

  var CAM = [
    [0, 24, 20, 170, -12], [4.0, 24, 20, 170, -12],
    [5.0, 18, 16, 250, 62], [9.0, 14, 14, 230, 66],
    [9.8, 16, 13, 300, 36], [12.4, 20, 12, 300, 40],
    [13.0, 22, 12, 400, 95], [16.0, 22, 12, 400, 95],
    [16.9, 28, 8, 140, -14], [20.2, 28, 8, 140, -14],
    [21.0, 34, 14, 310, 52], [L2 + 4.4, 38, 12, 310, 52],
    [L2 + 5.4, 36, 8, 145, -6], [L2 + 7.9, 36, 8, 145, -6],
    [L3 + 0.5, 44, 14, 320, 60], [L3 + 4.4, 48, 12, 320, 60],
    [L3 + 5.4, 46, 8, 150, 2], [L3 + 7.9, 46, 8, 150, 2],
    [H + 0.8, 40, 14, 320, 60], [H + 3.4, 30, 16, 260, 20],
    [H + 7.0, 30, 18, 175, -4], [END, 210, 18, 175, -4]
  ];

  var CAPS = [
    [0, 1.5, 'A', 'Pote vazio na bancada, boca de Ø55 mm.'],
    [1.5, 4.5, 'A', 'O gel base transparente sobe até 3 mm abaixo da rosca.'],
    [4.5, 6.4, 'B', 'O cabeçote, com os 13 bicos já colados, chega sobre o pote.'],
    [6.4, 9, 'B', 'O adaptador Luer encaixa no cabeçote: desce girando ¼ de volta.'],
    [9, 12.5, 'C', 'O cabeçote desce e assenta na boca do pote. Os bicos entram no gel.'],
    [12.5, 16, 'D', 'A seringa com o gel amarelo desce e encaixa no adaptador.'],
    [16, 19.7, 'E', 'O êmbolo desce um pouco, devagar e constante: 13 gotas crescem nas pontas dos bicos.'],
    [19.7, 20.5, 'E', 'As gotas ficam suspensas no gel. Camada 1 pronta: 13 pérolas.'],
    [L2, L2 + 1.9, 'F', 'A seringa sobe e o cabeçote sobe junto.'],
    [L2 + 1.9, L2 + 3.2, 'F', 'O anel 1 desce e assenta na boca do pote.'],
    [L2 + 3.2, L2 + 5.5, 'F', 'O cabeçote volta, 8 mm mais alto, e a seringa encaixa de novo.'],
    [L2 + 5.5, L2 + 8, 'F', 'O êmbolo desce: camada 2, 26 pérolas.'],
    [L3, L3 + 1.9, 'G', 'A seringa e o cabeçote sobem outra vez.'],
    [L3 + 1.9, L3 + 3.2, 'G', 'O anel 2 desce e assenta sobre o anel 1.'],
    [L3 + 3.2, L3 + 5.5, 'G', 'O cabeçote volta, 16 mm acima da boca, e a seringa encaixa.'],
    [L3 + 5.5, L3 + 8, 'G', 'O êmbolo desce: camada 3, 39 pérolas.'],
    [H, H + 3.6, 'H', 'Seringa, cabeçote e anéis saem.'],
    [H + 3.6, H + 7, 'H', 'A tampa dourada desce girando e rosqueia no pote.'],
    [H + 7, END + 1, 'H', 'Pronto: pote com 39 pérolas. A câmera dá meia volta.']
  ];
  var CHAPS = [[0, 'A'], [4.5, 'B'], [9, 'C'], [12.5, 'D'], [16, 'E'], [L2, 'F'], [L3, 'G'], [H, 'H']];

  function fmt(t) {
    var s = Math.floor(t + 1e-6);
    return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  }

  function initAnimator() {
    var host = $('stage2');
    var stage, rig;
    var t = 0, playing = false, camAuto = true;
    var playBtn = $('play'), slider = $('tempo');
    var chapBtns = Array.prototype.slice.call(document.querySelectorAll('#chaps .chap'));
    var lastCap = -1, lastChap = '', lastCount = -1, lastTxt = '';

    function camAt(tt) {
      var i;
      if (tt <= CAM[0][0]) return CAM[0].slice(1);
      for (i = 1; i < CAM.length; i++) {
        if (tt <= CAM[i][0]) {
          var u = smooth((tt - CAM[i - 1][0]) / (CAM[i][0] - CAM[i - 1][0])), a = CAM[i - 1], b = CAM[i];
          return [lerp(a[1], b[1], u), lerp(a[2], b[2], u), lerp(a[3], b[3], u), lerp(a[4], b[4], u)];
        }
      }
      return CAM[CAM.length - 1].slice(1);
    }

    function render(tt) {
      var s = {}, i;
      s.gel = track(tt, K.gel);
      var hx = track(tt, K.headX), hz = track(tt, K.headZ);
      rig.setGel(s.gel);
      rig.headGroup.position.set(hx, 0, hz);
      rig.headGroup.visible = hx < 165;
      rig.adGroup.position.set(hx, 0, hz + track(tt, K.adLift));
      rig.adGroup.rotation.z = track(tt, K.adRot);
      rig.adGroup.visible = hx < 165;
      var r0x = track(tt, K.ring0X), r1x = track(tt, K.ring1X);
      rig.rings[0].position.set(r0x, 0, track(tt, K.ring0Z)); rig.rings[0].visible = Math.abs(r0x) < 150;
      rig.rings[1].position.set(r1x, 0, track(tt, K.ring1Z)); rig.rings[1].visible = Math.abs(r1x) < 150;
      var sz = track(tt, K.syZ);
      rig.syringe.position.z = sz; rig.syringe.visible = sz < 232;
      rig.syringe.userData.setPlunger(track(tt, K.pl));
      var capOn = tt > H + 3.55;
      rig.cap.visible = capOn;
      if (capOn) { rig.cap.position.z = track(tt, K.capZ); rig.cap.rotation.z = -track(tt, K.capRot); }
      var count = 0;
      for (i = 0; i < 3; i++) {
        var p = clamp((tt - GROW[i][0]) / (GROW[i][1] - GROW[i][0]));
        var r = PEARL_R * Math.cbrt(p);
        var att = tt <= GROW[i][1] ? 1 : clamp(1 - (tt - GROW[i][1]) / 0.9);
        rig.setPearls(i, r, Math.round(smooth(att) * 4));
        if (p > 0) count += 13;
      }
      if (camAuto) { var c = camAt(tt); stage.setShot(c[0], c[1], c[2] * CAMMUL, c[3]); }

      // interface
      if (count !== lastCount) { $('contagem').textContent = 'Pérolas ' + count + ' / 39'; lastCount = count; }
      var ci = -1, chap = 'A';
      for (i = 0; i < CAPS.length; i++) if (tt >= CAPS[i][0] && tt < CAPS[i][1]) { ci = i; break; }
      if (ci < 0) ci = CAPS.length - 1;
      if (ci !== lastCap) {
        lastCap = ci;
        $('cap-txt').textContent = CAPS[ci][3];
        $('cap-cap').textContent = CAPS[ci][2];
      }
      for (i = 0; i < CHAPS.length; i++) if (tt >= CHAPS[i][0]) chap = CHAPS[i][1];
      if (chap !== lastChap) {
        lastChap = chap;
        chapBtns.forEach(function (b, bi) {
          if (CHAPS[bi][1] === chap) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
        });
      }
      var txt = fmt(tt) + ' / ' + fmt(END);
      if (txt !== lastTxt) {
        lastTxt = txt;
        $('tempo-out').textContent = txt;
        slider.setAttribute('aria-valuetext', txt + ', capítulo ' + chap);
      }
    }
    function setTime(v, fromSlider) {
      t = clamp(v, 0, END);
      if (!fromSlider) slider.value = t;
      render(t);
      stage.request();
    }
    function setPlaying(on) {
      playing = on;
      playBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      playBtn.setAttribute('aria-label', on ? 'Pausar animação' : (t >= END ? 'Reiniciar animação' : 'Reproduzir animação'));
      $('play-t').textContent = on ? 'Pausar' : (t >= END ? 'Reiniciar' : (t > 0 ? 'Continuar' : 'Reproduzir'));
      stage.request();
    }

    function ready(models) {
      stage = new Stage(host);
      rig = buildRig(models, stage, { syringe: true });
      rig.setCut(false);
      stage.controls.maxDistance = 900;
      stage.onFrame = function (dt) {
        if (!playing) return false;
        t += dt;
        if (t >= END) { t = END; slider.value = t; render(t); setPlaying(false); return false; }
        slider.value = t;
        render(t);
        return true;
      };
      stage.controls.addEventListener('start', function () {
        if (camAuto) { camAuto = false; $('camauto').checked = false; }
      });
      $('camauto').addEventListener('change', function () {
        camAuto = this.checked;
        render(t); stage.request();
      });
      playBtn.addEventListener('click', function () {
        if (playing) { setPlaying(false); return; }
        if (t >= END) setTime(0);
        setPlaying(true);
      });
      slider.addEventListener('input', function () { setPlaying(false); setTime(+slider.value, true); });
      chapBtns.forEach(function (b) {
        b.addEventListener('click', function () { setTime(+b.getAttribute('data-t') + 0.001); });
      });
      document.addEventListener('keydown', function (ev) {
        if (ev.key !== ' ' && ev.code !== 'Space') return;
        var a = document.activeElement;
        if (a && (a === host || a === stage.canvas)) { ev.preventDefault(); playBtn.click(); }
      });
      stage.canvas.tabIndex = 0;
      stage.canvas.setAttribute('aria-keyshortcuts', 'Space');
      setTime(0);
      setPlaying(false);
      hideLoading(host);
      // gancho de depuração/captura (não usado pelo site): render determinístico por tempo
      window.__p8000 = window.__p8000 || {};
      window.__p8000.anim = {
        stage: stage, rig: rig,
        setTime: function (v) {
          setPlaying(false); setTime(v);
          stage.controls.update();
          stage.renderer.render(stage.scene, stage.camera);
        },
        setFraming: function (fov, mul, shiftY) {
          stage.camera.fov = fov;
          if (shiftY) { var cw = host.clientWidth, ch = host.clientHeight; stage.camera.setViewOffset(cw, ch, 0, shiftY, cw, ch); }
          stage.camera.updateProjectionMatrix();
          CAMMUL = mul; render(t);
        }
      };
    }

    loadModels().then(ready).catch(function (err) {
      showError(host, 'Não foi possível exibir a animação: ' + (err && err.message ? err.message : 'erro desconhecido') + ' Os passos escritos estão em "Como usar".');
    });
  }

  /* ---------------------------------------------------------------- */
  /* Inicialização preguiçosa                                          */
  /* ---------------------------------------------------------------- */
  function lazy(id, fn) {
    var el = $(id);
    if (!el) return;
    if (!window.IntersectionObserver) { fn(); return; }
    var io = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { io.disconnect(); fn(); }
    }, { rootMargin: '400px' });
    io.observe(el);
  }

  function checkSupport() {
    if (!window.THREE || !THREE.STLLoader || !THREE.OrbitControls) {
      ['stage1', 'stage2'].forEach(function (id) {
        var h = $(id);
        if (h) showError(h, 'Não foi possível carregar a biblioteca 3D (arquivos em vendor/).');
      });
      return false;
    }
    try {
      var c = document.createElement('canvas');
      if (!(c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl'))) throw new Error('sem webgl');
    } catch (e) {
      ['stage1', 'stage2'].forEach(function (id) {
        var h = $(id);
        if (h) showError(h, 'Este navegador ou aparelho não tem WebGL. Veja as imagens e baixe os arquivos mesmo assim.');
      });
      return false;
    }
    return true;
  }

  function initNavSpy() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.nav-strip a'));
    if (!window.IntersectionObserver) return;
    var secs = links.map(function (a) { return document.querySelector(a.getAttribute('href')); });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) {
          var on = a.getAttribute('href') === '#' + e.target.id;
          a.classList.toggle('on', on);
          if (on) {
            a.setAttribute('aria-current', 'location');
            var strip = a.closest('.nav-strip');
            if (strip && strip.scrollWidth > strip.clientWidth) {
              var left = a.offsetLeft - strip.clientWidth / 2 + a.clientWidth / 2;
              strip.scrollTo({ left: left, behavior: REDUCED ? 'auto' : 'smooth' });
            }
          } else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    secs.forEach(function (s) { if (s) io.observe(s); });
  }

  function start() {
    initNavSpy();
    if (!checkSupport()) return;
    lazy('stage1', initExplorer);
    lazy('stage2', initAnimator);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
