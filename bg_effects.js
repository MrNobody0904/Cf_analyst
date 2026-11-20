/**
 * bg_effects.js - High-Performance Visual Telemetry & 3D WebGL Engine
 * 1. Cybernetic Code Typing Canvas Engine (Ultra Low-CPU)
 * 2. Interactive Three.js Wireframe Hologram & Particle Constellation
 * 3. System Boot Sequence / Smooth Preloader
 * 4. Reactive Scroll Reveal Observer
 */

(function () {
  'use strict';

  // =========================================================================
  // 1. SYSTEM BOOTLOADER SEQUENCE
  // =========================================================================
  const bootOverlay = document.getElementById('loadingOverlay');
  const bootBar = document.getElementById('bootBar');
  const bootText = document.getElementById('bootText');

  const bootMessages = [
    "INITIALIZING CORE...",
    "CONNECTING TELEMETRY...",
    "CALIBRATING SHADERS...",
    "SYSTEM READY"
  ];

  let bootProgress = 0;
  const bootInterval = setInterval(() => {
    bootProgress += Math.floor(Math.random() * 25) + 15;
    if (bootProgress > 100) bootProgress = 100;
    
    if (bootBar) bootBar.style.width = bootProgress + '%';
    
    const msgIndex = Math.min(
      Math.floor((bootProgress / 100) * bootMessages.length),
      bootMessages.length - 1
    );
    if (bootText) bootText.textContent = bootMessages[msgIndex];

    if (bootProgress >= 100) {
      clearInterval(bootInterval);
      setTimeout(() => {
        if (bootOverlay) {
          bootOverlay.classList.add('fade-out');
          setTimeout(() => {
            bootOverlay.style.display = 'none';
          }, 600);
        }
      }, 250);
    }
  }, 120);

  // =========================================================================
  // 2. CYBERNETIC CODE TYPING CANVAS ENGINE
  // =========================================================================
  const canvas = document.createElement('canvas');
  canvas.id = 'codeBgCanvas';
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    renderCanvas();
  }, { passive: true });

  const codeSnippets = [
    "template <typename T>",
    "struct SegmentTree {",
    "    int n; vector<T> tree;",
    "    SegmentTree(int n) : n(n), tree(4 * n, 0) {}",
    "    void update(int node, int start, int end, int idx, T val) {",
    "        if (start == end) { tree[node] += val; return; }",
    "        int mid = (start + end) / 2;",
    "        if (idx <= mid) update(2 * node, start, mid, idx, val);",
    "        else update(2 * node + 1, mid + 1, end, idx, val);",
    "        tree[node] = max(tree[2 * node], tree[2 * node + 1]);",
    "    }",
    "    T query(int node, int start, int end, int l, int r) {",
    "        if (r < start || end < l) return 0;",
    "        if (l <= start && end <= r) return tree[node];",
    "        int mid = (start + end) / 2;",
    "        return max(query(2 * node, start, mid, l, r), query(2 * node + 1, mid + 1, end, l, r));",
    "    }",
    "};",
    "",
    "long long binpow(long long a, long long b, long long m) {",
    "    a %= m; long long res = 1;",
    "    while (b > 0) {",
    "        if (b & 1) res = res * a % m;",
    "        a = a * a % m; b >>= 1;",
    "    }",
    "    return res;",
    "}"
  ];

  let currentSnippetIndex = 0;
  let currentCharIndex = 0;
  const historyLines = [];
  const maxVisibleLines = 26;

  function renderCanvas() {
    ctx.clearRect(0, 0, width, height);

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    ctx.fillStyle = isLight ? 'rgba(0, 82, 204, 0.05)' : 'rgba(0, 240, 255, 0.045)';
    ctx.font = '13px "IBM Plex Mono", Consolas, monospace';
    ctx.textBaseline = 'top';

    const lineHeight = 22;
    const startX = 35;
    const startY = 40;

    // Render historical lines
    for (let i = 0; i < historyLines.length; i++) {
      ctx.fillText(historyLines[i], startX, startY + i * lineHeight);
    }

    // Render current active typing line with cursor
    const currentFullLine = codeSnippets[currentSnippetIndex] || "";
    const currentTyped = currentFullLine.substring(0, currentCharIndex);
    const cursor = (Math.floor(Date.now() / 400) % 2 === 0) ? '▋' : ' ';
    ctx.fillStyle = isLight ? 'rgba(0, 82, 204, 0.12)' : 'rgba(0, 240, 255, 0.12)';
    ctx.fillText(currentTyped + cursor, startX, startY + historyLines.length * lineHeight);
  }

  // Type step loop throttled by interval to maintain near-zero CPU footprint
  setInterval(() => {
    if (document.hidden) return;

    const currentLine = codeSnippets[currentSnippetIndex];
    if (currentCharIndex < currentLine.length) {
      currentCharIndex++;
    } else {
      historyLines.push(currentLine);
      if (historyLines.length > maxVisibleLines) {
        historyLines.shift();
      }
      currentCharIndex = 0;
      currentSnippetIndex = (currentSnippetIndex + 1) % codeSnippets.length;
    }
    renderCanvas();
  }, 45);

  // =========================================================================
  // 3. INTERACTIVE THREE.JS HOLOGRAPHIC 3D SYSTEM
  // =========================================================================
  function initThree() {
    if (typeof THREE === 'undefined') return;

    const container = document.createElement('div');
    container.id = 'threeCanvasContainer';
    document.body.prepend(container);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 24;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // cap for performance
    container.appendChild(renderer.domElement);

    // Dynamic color depending on active theme
    function getAccentColor() {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      return isLight ? 0x0052cc : 0x00f0ff;
    }

    // 3D Holographic Geometry: Dual Icosahedron Wireframe
    const geometry = new THREE.IcosahedronGeometry(7, 1);
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: getAccentColor(),
      wireframe: true,
      transparent: true,
      opacity: 0.15
    });
    const icosahedron = new THREE.Mesh(geometry, wireframeMaterial);
    scene.add(icosahedron);

    // Inner Core
    const coreGeo = new THREE.IcosahedronGeometry(3.5, 0);
    const coreMat = new THREE.MeshBasicMaterial({
      color: getAccentColor(),
      wireframe: true,
      transparent: true,
      opacity: 0.25
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    scene.add(core);

    // Floating particle field
    const particleCount = 120;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 45;
      positions[i + 1] = (Math.random() - 0.5) * 35;
      positions[i + 2] = (Math.random() - 0.5) * 25;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: getAccentColor(),
      size: 0.12,
      transparent: true,
      opacity: 0.35
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // Mouse Interaction with Smooth Inertia
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    window.addEventListener('mousemove', (e) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = -(e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });

    // Window Resize Handler
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }, { passive: true });

    // Update material colors on theme toggle
    window.addEventListener('themeChanged', () => {
      const col = getAccentColor();
      wireframeMaterial.color.setHex(col);
      coreMat.color.setHex(col);
      particleMat.color.setHex(col);
      renderCanvas();
    });

    // Animation Loop with delta timing and visibility pause
    let clock = new THREE.Clock();

    function animate() {
      requestAnimationFrame(animate);

      if (document.hidden) return;

      const delta = clock.getDelta();

      // Smooth mouse lerping
      targetX += (mouseX - targetX) * 0.05;
      targetY += (mouseY - targetY) * 0.05;

      // Rotations
      icosahedron.rotation.x += delta * 0.12;
      icosahedron.rotation.y += delta * 0.18;
      icosahedron.position.x = targetX * 1.5;
      icosahedron.position.y = targetY * 1.5;

      core.rotation.x -= delta * 0.25;
      core.rotation.y -= delta * 0.3;

      particles.rotation.y += delta * 0.04;

      renderer.render(scene, camera);
    }
    animate();
  }

  // Check if THREE is already loaded or wait
  if (typeof THREE !== 'undefined') {
    initThree();
  } else {
    window.addEventListener('DOMContentLoaded', initThree);
  }

  // =========================================================================
  // 4. SCROLL REVEAL OBSERVER
  // =========================================================================
  window.initScrollReveal = function () {
    const targets = document.querySelectorAll('section, .panel, .grid2, .cols3, .streak-row');
    if (!('IntersectionObserver' in window)) {
      targets.forEach(t => t.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });

    targets.forEach(t => {
      t.classList.add('reveal');
      observer.observe(t);
    });
  };

  window.addEventListener('DOMContentLoaded', () => {
    window.initScrollReveal();
  });

})();
