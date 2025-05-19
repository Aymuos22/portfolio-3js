import * as THREE from 'three';
import { PointerLockControls } from 'PointerLockControls';
import { GLTFLoader } from 'GLTFLoader';
import * as SkeletonUtils from 'SkeletonUtils';

// --- Audio ---
const shootSound = new Audio('assets/shoot.mp3');
const footstepSound = new Audio('assets/footsteps.mp3');
const reloadSound = new Audio('assets/reload.mp3');
const beamSound = new Audio('assets/beam.mp3');
const damageSound = new Audio('assets/damage.mp3');
const healSound = new Audio('assets/heal.mp3');
footstepSound.loop = true;

// --- Game State ---
let health = 100;
let score = 0;
let bulletsLeft = 6;
let destroyedPeople = 0;
let gameOver = false;
let paused = true;
const apiURL = 'https://jsonplaceholder.typicode.com/posts/';

// --- Scene Setup ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 2000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- HUD Elements ---
const healthFill = document.getElementById('health-fill');

// --- Centered Score Display ---
const scoreElement = document.createElement('div');
scoreElement.id = 'score';
scoreElement.textContent = 'Score: 0';
Object.assign(scoreElement.style, {
  position: 'fixed',
  top: '20px',
  left: '50%',
  transform: 'translateX(-50%)',
  color: 'white',
  fontSize: '24px',
  zIndex: '20',
  textShadow: '0 0 5px black'
});
document.body.appendChild(scoreElement);

// --- Resume Download Button ---
const resumeLink = document.createElement('a');
resumeLink.href = 'assets/resume.pdf';
resumeLink.download = 'My_Resume.pdf';
resumeLink.textContent = 'Download My Resume';
Object.assign(resumeLink.style, {
  display: 'none',
  position: 'fixed',
  top: '60px',
  left: '50%',
  transform: 'translateX(-50%)',
  background: '#222',
  color: '#fff',
  padding: '10px 22px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontSize: '20px',
  zIndex: '30',
  boxShadow: '0 0 8px #000'
});
document.body.appendChild(resumeLink);

// --- Bullet Counter ---
const bulletCounter = document.createElement('div');
bulletCounter.id = 'bullets';
bulletCounter.textContent = '🔫: 6';
Object.assign(bulletCounter.style, {
  position: 'fixed',
  top: '60px',
  left: '20px',
  color: 'white',
  fontSize: '24px',
  zIndex: '20',
  textShadow: '0 0 5px black'
});
document.body.appendChild(bulletCounter);

// --- Notification System ---
const notification = document.createElement('div');
Object.assign(notification.style, {
  position: 'fixed',
  top: '20px',
  right: '20px',
  minWidth: '220px',
  maxWidth: '360px',
  background: 'rgba(32,32,32,0.95)',
  color: '#fff',
  borderRadius: '8px',
  padding: '14px 22px 14px 18px',
  boxShadow: '0 0 18px #0007',
  fontSize: '16px',
  zIndex: '9999',
  display: 'none',
  pointerEvents: 'none',
  textAlign: 'left'
});
document.body.appendChild(notification);

// --- Popup Elements ---
const popup = document.createElement('div');
Object.assign(popup.style, {
  display: 'none',
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  backgroundColor: 'rgba(0,0,0,0.9)',
  color: 'white',
  padding: '20px',
  borderRadius: '10px',
  textAlign: 'center',
  zIndex: '1000',
  maxWidth: '320px',
  boxShadow: '0 0 40px #000'
});
document.body.appendChild(popup);

const reloadPopup = document.createElement('div');
Object.assign(reloadPopup.style, {
  display: 'none',
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  backgroundColor: 'rgba(0,0,0,0.9)',
  color: 'white',
  padding: '20px',
  borderRadius: '10px',
  textAlign: 'center',
  zIndex: '1100',
  maxWidth: '320px',
  boxShadow: '0 0 40px #000'
});
reloadPopup.innerHTML = `<h3>Out of bullets!</h3><p>Press <b>R</b> to reload.</p>`;
document.body.appendChild(reloadPopup);

// --- Beam System ---
const beamCounter = document.createElement('div');
beamCounter.id = 'beam-counter';
Object.assign(beamCounter.style, {
  position: 'fixed',
  top: '100px',
  left: '20px',
  width: '120px',
  height: '24px',
  background: '#222',
  border: '2px solid #888',
  borderRadius: '12px',
  overflow: 'hidden',
  zIndex: '20'
});
const beamBar = document.createElement('div');
Object.assign(beamBar.style, {
  height: '100%',
  width: '0%',
  background: 'linear-gradient(90deg, #0f0, #0f0)',
  transition: 'width 0.2s'
});
beamCounter.appendChild(beamBar);
const beamText = document.createElement('span');
beamText.style.position = 'absolute';
beamText.style.left = '0';
beamText.style.right = '0';
beamText.style.top = '0';
beamText.style.bottom = '0';
beamText.style.margin = 'auto';
beamText.style.color = '#fff';
beamText.style.fontSize = '16px';
beamText.style.textAlign = 'center';
beamText.style.width = '100%';
beamText.style.height = '24px';
beamText.style.lineHeight = '24px';
beamText.textContent = 'Charging...';
beamCounter.appendChild(beamText);
document.body.appendChild(beamCounter);

let beamReady = false;
let beamCharge = 0;
const BEAM_RECHARGE_TIME = 7;
let lastBeamTime = performance.now();
let mouseDownTime = null;

// --- Updated HUD System ---
function updateHUD() {
  healthFill.style.width = `${health}%`;
  scoreElement.textContent = `Score: ${score}`;
  bulletCounter.textContent = `🔫: ${bulletsLeft}`;
  
  // Show resume download when score > 200
  if (score > 200) {
    resumeLink.style.display = 'block';
  } else {
    resumeLink.style.display = 'none';
  }
}

function updateBeamCounter() {
  const now = performance.now();
  let t = (now - lastBeamTime) / 1000;
  if (t > BEAM_RECHARGE_TIME) t = BEAM_RECHARGE_TIME;
  beamCharge = t / BEAM_RECHARGE_TIME;
  beamBar.style.width = (beamCharge * 100) + '%';
  if (beamCharge >= 1) {
    beamReady = true;
    beamText.textContent = 'Beam Ready!';
    beamBar.style.background = 'linear-gradient(90deg, #0f0, #0f0)';
  } else {
    beamReady = false;
    beamText.textContent = 'Charging...';
    beamBar.style.background = 'linear-gradient(90deg, #0f0, #0ff)';
  }
}

// --- Game World ---
const starGeometry = new THREE.BufferGeometry();
const starVertices = [];
for (let i = 0; i < 3000; i++) {
  starVertices.push(
    THREE.MathUtils.randFloatSpread(800),
    THREE.MathUtils.randFloatSpread(400) + 100,
    THREE.MathUtils.randFloatSpread(800)
  );
}
starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.7 });
const starField = new THREE.Points(starGeometry, starMaterial);
scene.add(starField);

const groundGeo = new THREE.PlaneGeometry(1000, 1000);
const groundMat = new THREE.MeshPhongMaterial({ color: 0x111122 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0;
ground.receiveShadow = true;
scene.add(ground);

// --- Lighting ---
scene.add(new THREE.AmbientLight(0x8888aa, 0.7));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(20, 50, 10);
scene.add(dirLight);
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
hemiLight.position.set(0, 200, 0);
scene.add(hemiLight);

// --- Controls ---
const controls = new PointerLockControls(camera, document.body);
camera.position.set(0, 2, 10);

// --- Controls Popup ---
const controlsPopup = document.createElement('div');
Object.assign(controlsPopup.style, {
  display: 'block',
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  backgroundColor: 'rgba(0,0,0,0.95)',
  color: 'white',
  padding: '28px 24px',
  borderRadius: '12px',
  textAlign: 'left',
  zIndex: '2000',
  maxWidth: '350px',
  boxShadow: '0 0 40px #000',
  fontSize: '18px'
});
controlsPopup.innerHTML = `
  <h2>Controls</h2>
  <ul style="margin-left: 16px; font-size: 17px;">
    <li><b>W/S/A/D</b> or <b>Arrow Keys</b>: Move</li>
    <li><b>Mouse</b>: Look around</li>
    <li><b>Left Click</b>: Shoot</li>
    <li><b>R</b>: Reload</li>
    <li><b>Hold Left Click &gt;0.5s (when Beam Ready)</b>: Fire Beam</li>
    <li><b>Beam</b>: Instantly destroys all enemies in a cone</li>
    <li><b>Green +</b>: Health pickup (+25%)</li>
    <li><b>Press Enter</b>: Close popups</li>
    <li>Score above 200 to unlock resume download</li>
  </ul>
  <p style="text-align:center; margin-top: 18px;"><b>Click anywhere to start!</b></p>
`;
document.body.appendChild(controlsPopup);

document.addEventListener('click', () => {
  if (controlsPopup.style.display !== 'none') {
    controlsPopup.style.display = 'none';
    paused = false;
    controls.lock();
  }
});

// --- Game Systems ---
function endGame() {
  gameOver = true;
  controls.unlock();
  document.getElementById('game-over').style.display = 'block';
  if (footstepSound && !footstepSound.paused) footstepSound.pause();
}
document.getElementById('restart-btn').onclick = () => {
  window.location.reload();
};

// --- Character System ---
const people = [];
const peopleMixers = [];
const peopleSpeeds = [];
const peopleDirections = [];
const PEOPLE_MODEL_PATH = 'assets/assassin_new.glb';
let basePerson = null;
let personAnimations = null;

const gltfLoader = new GLTFLoader();
gltfLoader.load(PEOPLE_MODEL_PATH, (gltf) => {
  basePerson = gltf.scene;
  personAnimations = gltf.animations;
  basePerson.traverse((child) => {
    if (child.name.toLowerCase().includes('knife')) {
      const handBone = basePerson.children[0].skeleton.bones[15];
      handBone.add(child);
      child.position.set(0, 0, 0);
    }
  });
  for (let i = 0; i < 10; i++) {
    spawnPerson(
      Math.random() * 60 - 30,
      1.5,
      Math.random() * 60 - 30
    );
  }
});

function spawnPerson(x, y, z) {
  if (!basePerson) return;
  const person = SkeletonUtils.clone(basePerson);
  person.position.set(x, 2.4, z);
  person.scale.set(1.2, 1.2, 1.2);
  scene.add(person);
  people.push(person);

  const mixer = new THREE.AnimationMixer(person);
  if (personAnimations?.length > 0) {
    mixer.clipAction(personAnimations[0]).play();
  }
  peopleMixers.push(mixer);

  peopleSpeeds.push(Math.random() * 0.07 + 0.03);
  peopleDirections.push(
    new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize()
  );
}

function maintainPeople() {
  while (people.length < 10 && basePerson) {
    spawnPerson(
      Math.random() * 60 - 30,
      1.5,
      Math.random() * 60 - 30
    );
  }
}

// --- Health System ---
class HealthPickup {
  constructor(x, z) {
    this.mesh = new THREE.Group();
    const crossGeo = new THREE.BoxGeometry(0.5, 0.1, 0.1);
    const crossMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const horizontal = new THREE.Mesh(crossGeo, crossMat);
    const vertical = new THREE.Mesh(crossGeo, crossMat);
    vertical.rotation.z = Math.PI/2;
    this.mesh.add(horizontal);
    this.mesh.add(vertical);
    this.mesh.position.set(x, 1, z);
    scene.add(this.mesh);
  }
}
const healthPickups = [];

// --- Weapon System ---
let gun;
const loader = new GLTFLoader();
loader.load('assets/sci-fi_pistol.glb', (gltf) => {
  gun = gltf.scene;
  gun.scale.set(0.5, 0.5, 0.5);
  gun.position.set(0.35, -0.25, -0.6);
  gun.rotation.set(0, Math.PI, 0);
  camera.add(gun);
  scene.add(camera);
});

// --- Projectile System ---
const bullets = [];
const bulletGeometry = new THREE.SphereGeometry(0.05, 8, 8);
const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xFF0000 });

function createBullet() {
  if (bulletsLeft <= 0 || paused) return;
  bulletsLeft--;
  updateHUD();

  const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  bullet.position.copy(camera.position);
  bullet.velocity = direction.clone().multiplyScalar(0.5);
  scene.add(bullet);
  bullets.push(bullet);

  setTimeout(() => {
    scene.remove(bullet);
    bullets.splice(bullets.indexOf(bullet), 1);
  }, 2000);
}

// --- Damage Feedback ---
let lastDamageTime = 0;
const screenFlash = document.createElement('div');
Object.assign(screenFlash.style, {
  position: 'fixed',
  top: '0',
  left: '0',
  width: '100%',
  height: '100%',
  backgroundColor: 'rgba(255,0,0,0.3)',
  pointerEvents: 'none',
  display: 'none',
  zIndex: '500'
});
document.body.appendChild(screenFlash);

// --- Input System ---
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let prevTime = performance.now();
let bobPhase = 0;
let isWalking = false;

document.addEventListener('keydown', (e) => {
  if (paused && reloadPopup.style.display === 'block' && e.code === 'KeyR') {
    reloadSound.currentTime = 0;
    reloadSound.play();
    bulletsLeft = 6;
    updateHUD();
    reloadPopup.style.display = 'none';
    paused = false;
    if (!gameOver) controls.lock();
    return;
  }
  if (paused) return;
  switch (e.code) {
    case 'KeyS': case 'ArrowDown': moveForward = true; break;
    case 'KeyW': case 'ArrowUp': moveBackward = true; break;
    case 'KeyA': case 'ArrowLeft': moveLeft = true; break;
    case 'KeyD': case 'ArrowRight': moveRight = true; break;
    case 'KeyR':
      if (!gameOver && bulletsLeft < 6) {
        reloadSound.currentTime = 0;
        reloadSound.play();
        bulletsLeft = 6;
        updateHUD();
      }
      break;
  }
});

document.addEventListener('keyup', (e) => {
  if (paused) return;
  switch (e.code) {
    case 'KeyS': case 'ArrowDown': moveForward = false; break;
    case 'KeyW': case 'ArrowUp': moveBackward = false; break;
    case 'KeyA': case 'ArrowLeft': moveLeft = false; break;
    case 'KeyD': case 'ArrowRight': moveRight = false; break;
  }
});

document.addEventListener('mousedown', (e) => {
  if (!controls.isLocked || gameOver || paused) return;
  if (e.button === 0) {
    mouseDownTime = performance.now();
  }
});

document.addEventListener('mouseup', (e) => {
  if (!controls.isLocked || gameOver || paused) return;
  if (e.button === 0 && mouseDownTime) {
    const held = performance.now() - mouseDownTime;
    mouseDownTime = null;
    if (beamReady && held > 500) {
      fireBeam();
    } else {
      if (bulletsLeft <= 0) {
        paused = true;
        reloadPopup.style.display = 'block';
        controls.unlock();
        return;
      }
      shootSound.currentTime = 0;
      shootSound.play();
      createBullet();
      if (gun) {
        gun.position.z -= 0.12;
        setTimeout(() => { gun.position.z += 0.12; }, 100);
      }
    }
  }
});

// --- Beam System ---
function fireBeam() {
  if (!beamReady || paused || gameOver) return;
  lastBeamTime = performance.now();
  beamReady = false;
  updateBeamCounter();

  beamSound.currentTime = 0;
  beamSound.play();

  const beamLength = 60;
  const beamGeom = new THREE.CylinderGeometry(0.4, 0.4, beamLength, 32);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide
  });
  const beam = new THREE.Mesh(beamGeom, beamMat);

  beam.position.copy(camera.position);
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  beam.position.add(dir.clone().multiplyScalar(beamLength / 2));
  scene.add(beam);

  const spriteMap = new THREE.TextureLoader().load('https://threejs.org/examples/textures/sprites/glow.png');
  const spriteMaterial = new THREE.SpriteMaterial({ map: spriteMap, color: 0x00ff00, blending: THREE.AdditiveBlending });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(3, 3, 1);
  sprite.position.copy(camera.position).add(dir.clone().multiplyScalar(1));
  scene.add(sprite);

  const coneAngle = Math.PI/4;
  for (let i = people.length - 1; i >= 0; i--) {
    const person = people[i];
    const toPerson = person.position.clone().sub(camera.position);
    const distance = toPerson.length();
    const angle = dir.angleTo(toPerson.normalize());
    if (distance < beamLength && angle < coneAngle/2) {
      scene.remove(person);
      peopleMixers.splice(i, 1);
      peopleSpeeds.splice(i, 1);
      peopleDirections.splice(i, 1);
      people.splice(i, 1);
      score += 20;
      destroyedPeople++;
      updateHUD();
      maintainPeople();
      if (Math.random() < 0.25) {
        healthPickups.push(new HealthPickup(
          person.position.x + Math.random()*4-2,
          person.position.z + Math.random()*4-2
        ));
      }
    }
  }

  setTimeout(() => {
    scene.remove(beam);
    scene.remove(sprite);
  }, 300);
}

// --- API System ---
let currentSectionIndex = 0;
const totalSections = 7;
const api = 'https://portfolio-backend-8epd.onrender.com/api/sections/';

async function showPopup() {
  try {
    const response = await fetch(api + currentSectionIndex);
    if (!response.ok) throw new Error('API error');
    const result = await response.json();
    const data = result.data;
  
    notification.innerHTML = `
      <b>${data.title}</b>
      <div style="margin-top:5px;font-size:15px;">${data.content}</div>
    `;
    notification.style.display = 'block';
    currentSectionIndex = (currentSectionIndex + 1) % totalSections;
  } catch (error) {
    notification.innerHTML = `<b>API error</b>`;
    notification.style.display = 'block';
  }
}

// --- Main Game Loop ---
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  updateBeamCounter();

  if (!paused) {
    // Character Animation
        // Character Animation
        people.forEach((person, i) => {
            peopleMixers[i].update(delta);
      
            // 1. Face the intended direction
            person.lookAt(person.position.clone().add(peopleDirections[i]));
      
            // 2. Move along the model's local forward (-Z) axis
            const forward = new THREE.Vector3(0, 0, -1);
            forward.applyQuaternion(person.quaternion);
            person.position.addScaledVector(forward, peopleSpeeds[i]);
      
            // 3. Bounce off walls and reverse direction
            if (Math.abs(person.position.x) > 48) peopleDirections[i].x *= -1;
            if (Math.abs(person.position.z) > 48) peopleDirections[i].z *= -1;
          });
    // Update the position of the people          

    // Bullet Physics
    bullets.forEach((bullet, index) => {
      bullet.position.add(bullet.velocity);
      people.forEach((person, i) => {
        if (bullet.position.distanceTo(person.position) < 1.2) {
          scene.remove(person);
          people.splice(i, 1);
          peopleMixers.splice(i, 1);
          peopleSpeeds.splice(i, 1);
          peopleDirections.splice(i, 1);
          scene.remove(bullet);
          bullets.splice(index, 1);
          score += 10;
          destroyedPeople++;
          updateHUD();
          maintainPeople();
          if (destroyedPeople % 2 === 0) showPopup();
          if (Math.random() < 0.25) {
            healthPickups.push(new HealthPickup(
              bullet.position.x + Math.random()*4-2,
              bullet.position.z + Math.random()*4-2
            ));
          }
        }
      });
    });

    // Health Pickups
    const playerPos = controls.getObject().position;
    healthPickups.forEach((pickup, i) => {
      if (pickup.mesh.position.distanceTo(playerPos) < 1.5) {
        health = Math.min(100, health + 25);
        healSound.currentTime = 0;
        healSound.play();
        updateHUD();
        scene.remove(pickup.mesh);
        healthPickups.splice(i, 1);
      }
    });

    // Player Movement
    if (controls.isLocked && !gameOver) {
      const time = performance.now();
      const delta = (time - prevTime) / 1000;
      prevTime = time;

      direction.set(
        Number(moveRight) - Number(moveLeft),
        0,
        Number(moveBackward) - Number(moveForward)
      ).normalize();

      velocity.x = direction.x * 9 * delta;
      velocity.z = direction.z * 9 * delta;

      controls.moveRight(velocity.x);
      controls.moveForward(velocity.z);

      // Movement Effects
      isWalking = (moveForward || moveBackward || moveLeft || moveRight);
      if (isWalking) {
        bobPhase += delta * 12;
        camera.position.y = 2 + Math.sin(bobPhase) * 0.07;
        if (footstepSound.paused) {
          footstepSound.currentTime = 0;
          footstepSound.play();
        }
      } else {
        camera.position.y = 2;
        bobPhase = 0;
        if (!footstepSound.paused) footstepSound.pause();
      }
      if (gun) gun.position.y = Math.sin(bobPhase) * 0.04 - 0.25;
    }

    // Collision Detection
    if (!gameOver) {
      const playerBox = new THREE.Box3(
        new THREE.Vector3(camera.position.x - 0.5, 1, camera.position.z - 0.5),
        new THREE.Vector3(camera.position.x + 0.5, 3, camera.position.z + 0.5)
      );
      people.forEach(person => {
        const personBox = new THREE.Box3().setFromObject(person);
        if (playerBox.intersectsBox(personBox)) {
          health = Math.max(0, health - 0.7);
          lastDamageTime = performance.now();
          damageSound.currentTime = 0;
          damageSound.play();
          updateHUD();
          if (health <= 0) endGame();
        }
      });
    }
  }

  // Visual Feedback
  if (performance.now() - lastDamageTime < 500) {
    screenFlash.style.display = 'block';
  } else {
    screenFlash.style.display = 'none';
  }

  renderer.render(scene, camera);
}
animate();

// --- Window Management ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
