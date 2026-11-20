// bg_effects.js – adds background visual flair
// 1. Code typing effect on a canvas
// 2. Three.js rotating cube overlay
// 3. Simple IntersectionObserver scroll reveal for sections
// 4. Loading overlay fade out

// ----- 1. Code typing background -----
const codeCanvas = document.createElement('canvas');
codeCanvas.id = 'codeBgCanvas';
codeCanvas.style.position = 'fixed';
codeCanvas.style.top = '0';
codeCanvas.style.left = '0';
codeCanvas.style.width = '100%';
codeCanvas.style.height = '100%';
codeCanvas.style.zIndex = '-2';
codeCanvas.style.pointerEvents = 'none';
document.body.appendChild(codeCanvas);
const ctx = codeCanvas.getContext('2d');

function resizeCanvas() {
  codeCanvas.width = window.innerWidth;
  codeCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Sample code snippets to type
const snippets = [
  "function fetchUser(handle) {",
  "  return fetch(`https://codeforces.com/api/user.info?handles=${handle}`)"
    + ".then(r => r.json());",
  "}",
  "const rating = await fetchUser('tourist');",
  "console.log(rating);",
];
let lineIndex = 0;
let charIndex = 0;
let y = 30;
const lineHeight = 24;
function draw() {
  ctx.clearRect(0, 0, codeCanvas.width, codeCanvas.height);
  ctx.fillStyle = 'rgba(10,10,10,0.08)';
  ctx.fillRect(0, 0, codeCanvas.width, codeCanvas.height);
  ctx.font = '14px "JetBrains Mono", monospace';
  ctx.fillStyle = '#0a0a0a';
  ctx.textBaseline = 'top';
  // render previous lines
  for (let i = Math.max(0, lineIndex - 10); i <= lineIndex; i++) {
    const txt = i === lineIndex ? snippets[i].slice(0, charIndex) : snippets[i];
    ctx.fillText(txt, 20, y + (i - lineIndex) * lineHeight);
  }
  // advance
  if (lineIndex < snippets.length) {
    charIndex++;
    if (charIndex > snippets[lineIndex].length) {
      lineIndex++;
      charIndex = 0;
    }
    requestAnimationFrame(draw);
  } else {
    // loop after a pause
    setTimeout(() => {
      lineIndex = 0;
      charIndex = 0;
      requestAnimationFrame(draw);
    }, 2000);
  }
}
requestAnimationFrame(draw);

// ----- 2. Three.js rotating cube -----
function loadThreeJS(cb) {
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r152/three.min.js';
  script.onload = cb;
  document.head.appendChild(script);
}
loadThreeJS(() => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.style.position = 'fixed';
  renderer.domElement.style.top = '0';
  renderer.domElement.style.left = '0';
  renderer.domElement.style.zIndex = '-1';
  renderer.domElement.style.pointerEvents = 'none';
  document.body.appendChild(renderer.domElement);

  const geometry = new THREE.BoxGeometry(2, 2, 2);
  const material = new THREE.MeshNormalMaterial({ transparent: true, opacity: 0.4 });
  const cube = new THREE.Mesh(geometry, material);
  scene.add(cube);
  camera.position.z = 5;

  function animate() {
    requestAnimationFrame(animate);
    cube.rotation.x += 0.005;
    cube.rotation.y += 0.007;
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });
});

// ----- 3. Scroll reveal -----
const revealElements = document.querySelectorAll('section, .panel, .grid2, .cols3');
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('reveal');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });
revealElements.forEach(el => observer.observe(el));

// ----- 4. Loading overlay fade out -----
window.addEventListener('load', () => {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.classList.add('fade-out');
    setTimeout(() => overlay.remove(), 800);
  }
});
