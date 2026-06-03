// 导入模块
import { Shaders } from './js/shaders.js';
import { albumData, USE_LOCAL_ASSETS, placeholderRadio, INTRO_RADIO_PATH, INTRO_TITLE_PATH, 
         RADIO_SCALE, RADIO_Y, TITLE_SCALE, TITLE_Y, TITLE_Z,
         PARTICLE_OPACITY_BASE, PARTICLE_OPACITY_MIN, PARTICLE_OPACITY_MAX, PARTICLE_BLINK_SPEED_MAX,
         RESONANCE_MAX_CLICKS, RESONANCE_MULTIPLIER, RESONANCE_BASE_COUNT, RESONANCE_SPREAD, RESONANCE_MIN_RADIUS,
         DEFAULT_CAM_Z, DEFAULT_CAM_Y, MIN_ZOOM, MAX_ZOOM } from './js/data.js';
import { userSystem, PARTICLE_COLORS, PARTICLE_SHAPES, setDependencies as setUserSystemDependencies } from './js/user-system.js';
import { uiManager, setDependencies as setUIManagerDependencies } from './js/ui-manager.js';
import { audioManager, setDependencies as setAudioManagerDependencies, updateFocusedAlbum } from './js/audio-manager.js';
import { createResonanceParticleGroup, updateResonanceParticleGeometry } from './js/resonance-particles.js';
import { memoryCards } from './js/memory-cards.js';

// 初始化模块并设置依赖关系
let focusedAlbum = null;
let updateResonanceGeometryFn = null;
        
// 设置全局变量
window.userSystem = userSystem;
window.uiManager = uiManager;
window.PARTICLE_COLORS = PARTICLE_COLORS;
window.albumData = albumData;
        
// 初始化 UI Manager
uiManager.init();
setUIManagerDependencies(userSystem, albumData);
        
// 初始化 Audio Manager
audioManager.init();
setAudioManagerDependencies(userSystem, albumData, { get value() { return focusedAlbum; }, set value(v) { focusedAlbum = v; } });
        
// 初始化 User System（需要 updateResonanceGeometry 函数，稍后设置）
userSystem.init();
        
// 绑定 UI 事件
document.getElementById('overlay-container').onclick = (e) => {
    if (e.target === e.currentTarget) {
        uiManager.closeOverlay();
    }
};
        
document.getElementById('user-icon-btn').onclick = () => uiManager.openOverlay();
document.getElementById('switch-to-register').onclick = () => uiManager.switchModal('register');
document.getElementById('switch-to-login').onclick = () => uiManager.switchModal('login');
document.getElementById('btn-cheat-login').onclick = () => userSystem.cheatLogin();
document.getElementById('btn-login').onclick = () => { 
    const u = document.getElementById('login-username').value; 
    const p = document.getElementById('login-password').value; 
    if(u && p) userSystem.login(u, p); 
};
document.getElementById('btn-register').onclick = () => {
    const u = document.getElementById('reg-username').value.trim(); 
    const p = document.getElementById('reg-password').value; 
    const pc = document.getElementById('reg-confirm').value;
    if (!/^[\u4e00-\u9fa5a-zA-Z_]+$/.test(u)) { alert("格式无效"); return; }
    if (p !== pc || p.length < 1) { alert("请检查密码"); return; }
    userSystem.register(u, p);
};
document.getElementById('btn-logout').onclick = () => userSystem.logout();
        
// 绑定音频按钮事件
document.getElementById('track-play-btn').onclick = (e) => {
    e.stopPropagation();
    audioManager.handleMainPlayClick();
};
        
document.getElementById('resonate-btn').onclick = (e) => {
    e.stopPropagation();
    audioManager.resonate();
};
        
// 场景初始化代码
const container = document.getElementById('canvas-container'); 

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050505, 0.012);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = DEFAULT_CAM_Z;
camera.position.y = DEFAULT_CAM_Y;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

// --- Intro Group ---
const introGroup = new THREE.Group();
scene.add(introGroup);
introGroup.position.y = RADIO_Y; 

const radioLoader = new THREE.TextureLoader();
        
// --- Radio Mesh ---
const introRadioMat = new THREE.ShaderMaterial({
    uniforms: {
        tDiffuse: { value: new THREE.TextureLoader().load(placeholderRadio) },
        uTime: { value: 0 },
        uGlitchStrength: { value: 0 },
        uOpacity: { value: 1.0 }, 
        uDarkness: { value: 0.0 }
    },
    vertexShader: Shaders.glitchVertex,
    fragmentShader: Shaders.glitchFragment,
    transparent: true,
    side: THREE.DoubleSide
});

// 初始大尺寸，确保可见
const introRadioMesh = new THREE.Mesh(new THREE.PlaneGeometry(150, 115), introRadioMat);
introGroup.add(introRadioMesh);
        
// --- Title Mesh ---
const introTitleMat = new THREE.ShaderMaterial({
     uniforms: {
        tDiffuse: { value: new THREE.TextureLoader().load(placeholderRadio) },
        uTime: { value: 0 },
        uGlitchStrength: { value: 0 },
        uOpacity: { value: 0.0 }, 
        uDarkness: { value: 0.0 }
     },
     vertexShader: Shaders.glitchVertex,
     fragmentShader: Shaders.glitchFragment,
     transparent: true,
     side: THREE.DoubleSide,
     depthTest: false 
});
const introTitleMesh = new THREE.Mesh(new THREE.PlaneGeometry(100, 20), introTitleMat);
introTitleMesh.position.y = TITLE_Y;
introTitleMesh.position.z = TITLE_Z;
introGroup.add(introTitleMesh);

// Helper function for fallback textures (colors/text)
function createGeneratedTexture(text, colorIndex) {
    const c=document.createElement('canvas');c.width=512;c.height=512;const x=c.getContext('2d');
    x.fillStyle=getHslColorString(colorIndex);x.fillRect(0,0,512,512);x.strokeStyle='#fff';x.lineWidth=20;x.strokeRect(10,10,492,492);
    x.fillStyle='#fff';x.font="bold 120px Helvetica";x.textAlign="center";x.textBaseline="middle";x.fillText(text,256,256);
    const t=new THREE.CanvasTexture(c);
    t.anisotropy=renderer.capabilities.getMaxAnisotropy();
    return t;
}

// 噪点背景
const fsNoiseMat = new THREE.ShaderMaterial({
    uniforms: {
        tDiffuse: { value: null }, 
        uTime: { value: 0 },
        uGlitchStrength: { value: 0 },
        uOpacity: { value: 0 },
        uDarkness: { value: 0.0 }
    },
    vertexShader: Shaders.glitchVertex,
    fragmentShader: Shaders.glitchFragment,
    transparent: true,
    depthTest: false,
    depthWrite: false
});
const fsPlane = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), fsNoiseMat);
fsPlane.position.z = 50; 
introGroup.add(fsPlane);

const noiseC = document.createElement('canvas');
noiseC.width = 512; noiseC.height = 512;
const nCtx = noiseC.getContext('2d');
const nImgData = nCtx.createImageData(512, 512);
for(let i=0; i<nImgData.data.length; i+=4) {
    const val = Math.random() * 255;
    nImgData.data[i] = val; nImgData.data[i+1] = val; nImgData.data[i+2] = val; nImgData.data[i+3] = 255; 
}
nCtx.putImageData(nImgData, 0, 0);
const noiseTex = new THREE.CanvasTexture(noiseC);
fsNoiseMat.uniforms.tDiffuse.value = noiseTex;
        
// 加载标题图片
radioLoader.load(
    INTRO_TITLE_PATH, 
    (tex) => {
        console.log('✓ intro_title.png 加载成功');
        introTitleMat.uniforms.tDiffuse.value = tex;
        const img = tex.image;
        const dist = 75;
        const vFOV = THREE.Math.degToRad(camera.fov);
        const visibleHeight = 2 * Math.tan(vFOV / 2) * dist; 
        const visibleWidth = visibleHeight * camera.aspect;
        const imgAspect = img.width / img.height;
        const screenAspect = visibleWidth / visibleHeight;
        let w, h;
        if (screenAspect > imgAspect) {
            w = visibleWidth;
            h = visibleWidth / imgAspect;
        } else {
            h = visibleHeight;
            w = visibleHeight * imgAspect;
        }
        introTitleMesh.geometry.dispose();
        introTitleMesh.geometry = new THREE.PlaneGeometry(w * TITLE_SCALE, h * TITLE_SCALE);
    },
    undefined,
    (error) => {
        console.error('✗ intro_title.png 加载失败:', error);
        console.error('尝试的路径:', INTRO_TITLE_PATH);
        // 即使加载失败，也确保 mesh 可见（使用 placeholder）
        introTitleMat.uniforms.tDiffuse.value = new THREE.TextureLoader().load(placeholderRadio);
    }
);

// 加载收音机图片
radioLoader.load(
    INTRO_RADIO_PATH, 
    (tex) => {
        console.log('✓ intro_radio.png 加载成功');
        introRadioMat.uniforms.tDiffuse.value = tex;
        const img = tex.image;
        const dist = 75;
        const vFOV = THREE.Math.degToRad(camera.fov);
        const visibleHeight = 2 * Math.tan(vFOV / 2) * dist; 
        const imgAspect = img.width / img.height;
        const visibleWidth = visibleHeight * camera.aspect;
        const screenAspect = visibleWidth / visibleHeight;
        let w, h;
        if (screenAspect > imgAspect) {
            w = visibleWidth;
            h = visibleWidth / imgAspect;
        } else {
            h = visibleHeight;
            w = visibleHeight * imgAspect;
        }
        introRadioMesh.geometry.dispose();
        introRadioMesh.geometry = new THREE.PlaneGeometry(w * RADIO_SCALE, h * RADIO_SCALE);
    },
    undefined,
    (error) => {
        console.error('✗ intro_radio.png 加载失败:', error);
        console.error('尝试的路径:', INTRO_RADIO_PATH);
        // 即使加载失败，也确保 mesh 可见（使用 placeholder）
        introRadioMat.uniforms.tDiffuse.value = new THREE.TextureLoader().load(placeholderRadio);
    }
);

// --- Main Scene Objects ---
const albumGroup = new THREE.Group();
const albums = []; 
albumGroup.visible = false;
scene.add(albumGroup);

const particleCount = 20000;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(particleCount * 3);
const pRand = new Float32Array(particleCount);
const pSize = new Float32Array(particleCount);
const pSpeed = new Float32Array(particleCount);
const pOffset = new Float32Array(particleCount);
const pBand = new Float32Array(particleCount);

const fadeMargin = 15.0;
const groupBoundaries = [];
const boxGeometry = new THREE.BoxGeometry(4, 4, 0.1); 
const sideMaterial = new THREE.MeshBasicMaterial({ color: 0x111111 }); 

function getHslColorString(index) { return `hsl(${(index * 12) % 360}, 70%, 50%)`; }

const overlayTexture = (function(){
    const c=document.createElement('canvas');c.width=512;c.height=512;const x=c.getContext('2d');
    x.fillStyle='rgba(0,0,0,0.68)';x.fillRect(0,0,512,512);x.strokeStyle='rgba(255,255,255,0.45)';
    x.lineWidth=2;x.strokeRect(28,28,456,456);x.fillStyle='#fff';x.font="34px sans-serif";
    x.textAlign="center";x.textBaseline="middle";x.fillText("输入我的专属回忆",256,246);
    x.fillStyle='rgba(255,255,255,0.62)';x.font="18px sans-serif";x.fillText("CLICK TO WRITE",256,294);
    return new THREE.CanvasTexture(c);
})();

function createCardTexture(text, colorIndex, groupIndex, type, stackIndex) {
    // Default fallback texture (canvas generated)
    const fallbackTex = createGeneratedTexture(text, colorIndex);

    if(USE_LOCAL_ASSETS) {
        // Construct filename logic based on type
        let filename = `${groupIndex}(0).jpg`;
        if (type === 'down') filename = `${groupIndex}(${stackIndex}).jpg`;
        if (type === 'up') filename = `${groupIndex}(-${stackIndex}).jpg`;
        const path = `assets/${groupIndex}/${filename}`;

        // Try to load local asset manually first to catch errors
        const loader = new THREE.ImageLoader();
        loader.load(path, 
            function (image) {
                // Success: update texture
                fallbackTex.image = image;
                fallbackTex.needsUpdate = true;
            },
            undefined,
            function (err) {
                // Error: silent fail, keep fallback
                // console.warn("Image load failed:", path); // Suppress warning to clean console
            }
        );
        return fallbackTex;
    }
    return fallbackTex;
}

function updateResonanceGeometry(system, count, shapes = ['circle']) {
    updateResonanceParticleGeometry(THREE, system, count, shapes, {
        minRadius: RESONANCE_MIN_RADIUS,
        spread: RESONANCE_SPREAD
    });
}

function createCard(u, vOffset, label, colorIndex, groupIndex, type, stackIndex) {
    const containerGroup = new THREE.Group();
    const mainTex = createCardTexture(label, colorIndex, groupIndex, type, stackIndex);
    const mainMat = new THREE.MeshBasicMaterial({ map: mainTex, color: 0xffffff });
    const mesh = new THREE.Mesh(boxGeometry, [sideMaterial,sideMaterial,sideMaterial,sideMaterial,mainMat,mainMat]);
    containerGroup.add(mesh);

    const backGroup = new THREE.Group();
    const backMesh = new THREE.Mesh(new THREE.PlaneGeometry(4,4), mainMat);
    const overMesh = new THREE.Mesh(new THREE.PlaneGeometry(4,4), new THREE.MeshBasicMaterial({map:overlayTexture, transparent:true, opacity:1, side:THREE.DoubleSide}));
    overMesh.position.z = 0.01; overMesh.visible = false;
    backGroup.add(backMesh); backGroup.add(overMesh);
    backGroup.rotation.y = Math.PI; backGroup.position.z = -0.051;
    mesh.add(backGroup);

    const pSys = createResonanceParticleGroup(THREE, PARTICLE_SHAPES);
    containerGroup.add(pSys);

    containerGroup.userData = {
        u, offsetY: vOffset, posIndex: colorIndex, groupId: groupIndex,
        labelText: label, isFlipped: false, currentScale: 1.0,
        originalMaterial: mainMat, innerMesh: mesh, cardType: type,
        overlayMesh: overMesh, resonanceParticles: pSys, 
        localClicks: 0, currentParticleCount: 0 
    };
            
    albumGroup.add(containerGroup);
    albums.push(containerGroup);
            
    // Expose globally for sync
    if (!window.albums) window.albums = [];
    window.albums.push(containerGroup);
}

const albumCount = 30;
const spacing = 5.0;
const groupOrder = [12, 29, 18, 5, 11, 25, 13, 24, 8, 21, 22, 27, 28, 30, 7, 20, 1, 2, 4, 10, 15, 16, 17, 19, 26, 6, 23, 3, 9, 14];
        
for (let i = 0; i < albumCount; i++) {
    const visualAngle = (i / albumCount) * Math.PI * 2; 
    const u = (i % 2 === 1) ? visualAngle + Math.PI * 2 : visualAngle;
    const n = groupOrder[i];
    let minM = 0; let maxM = 0;
    for (let m = 1; m <= 15; m++) { if (albumData[`${n}(${m})`]) maxM = m; else break; }
    for (let m = 1; m <= 15; m++) { if (albumData[`${n}(-${m})`]) minM = -m; else break; }
    groupBoundaries.push({ u, vMin: (Math.min(0, minM) * spacing) - 2.0, vMax: (Math.max(0, maxM) * spacing) + 2.0 });
    createCard(u, 0, `${n}(0)`, i, n, 'main', 0);
    for (let m = 1; m <= maxM; m++) createCard(u, spacing * m, `${n}(${m})`, i, n, 'down', m);
    for (let m = 1; m <= Math.abs(minM); m++) createCard(u, -spacing * m, `${n}(-${m})`, i, n, 'up', m);
}
groupBoundaries.sort((a, b) => a.u - b.u);
memoryCards.init({
    THREE,
    albums,
    getFocusedAlbum: () => focusedAlbum,
    focusAlbum: (album) => focusOnAlbum(album),
    camera,
    renderer
});

function getBoundaryAt(targetU) {
    let u = targetU % (4 * Math.PI); if (u < 0) u += 4 * Math.PI;
    let p1 = groupBoundaries[groupBoundaries.length - 1], p2 = groupBoundaries[0];
    for (let i = 0; i < groupBoundaries.length - 1; i++) {
        if (u >= groupBoundaries[i].u && u < groupBoundaries[i+1].u) { p1 = groupBoundaries[i]; p2 = groupBoundaries[i+1]; break; }
    }
    let u1 = p1.u, u2 = p2.u; if (u2 < u1) { u2 += 4 * Math.PI; if (u < u1) u += 4 * Math.PI; }
    const t = ((u - u1) / (u2 - u1));
    const tSmooth = t * t * (3 - 2 * t);
    return { vMin: p1.vMin + (p2.vMin - p1.vMin) * tSmooth, vMax: p1.vMax + (p2.vMax - p1.vMax) * tSmooth };
}

for (let i = 0; i < particleCount; i++) {
    pPos[i*3]=0; pPos[i*3+1]=0; pPos[i*3+2]=0;
    pRand[i]=Math.random(); pSize[i]=Math.random()<0.2 ? Math.random()*1.5+0.5 : Math.random();
    pSpeed[i]=0.15+(Math.random()-0.5)*0.02; 
    const u=Math.random()*4*Math.PI; pOffset[i]=u;
    const b=getBoundaryAt(u); const h=b.vMax-b.vMin; const total=h+fadeMargin; const r=Math.random()*total;
    if(r<h) pBand[i]=b.vMin+r; else { const d=fadeMargin*(1-Math.sqrt(Math.random())); pBand[i]=(Math.random()<0.5)?b.vMax+d : b.vMin-d; }
}
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('aRandom', new THREE.BufferAttribute(pRand, 1));
pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1));
pGeo.setAttribute('aSpeed', new THREE.BufferAttribute(pSpeed, 1));
pGeo.setAttribute('aOffset', new THREE.BufferAttribute(pOffset, 1));
pGeo.setAttribute('aBandPosition', new THREE.BufferAttribute(pBand, 1));
        
const particleMaterial = new THREE.ShaderMaterial({
    vertexShader: Shaders.particleVertex,
    fragmentShader: Shaders.particleFragment,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0xffffff) }, uGlobalAlpha: { value: 1.0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
});
const particleSystem = new THREE.Points(pGeo, particleMaterial);
particleSystem.frustumCulled = false;
particleSystem.visible = false; 
scene.add(particleSystem);

function getMobiusPos(u, v) {
    const r=35, w=Math.sin(u*2)*5, ch=Math.cos(u*0.5), sh=Math.sin(u*0.5), cu=Math.cos(u), su=Math.sin(u);
    const x=(r+v*ch)*cu, y=(r+v*ch)*su, z=v*sh+w;
    const ca=Math.cos(0.4), sa=Math.sin(0.4);
    return new THREE.Vector3(x, y*ca-z*sa, y*sa+z*ca);
}

// --- Interaction & Animation State ---
let trX = 0, trY = 0, mX = 0, mY = 0, isDrag = false, isPan = false;
let dragS = {x:0,y:0}, lastM = {x:0,y:0}, simTime = 0;
let isFocused = false, isPaused = false;
let camT = new THREE.Vector3(0, DEFAULT_CAM_Y, DEFAULT_CAM_Z);
let camL = new THREE.Vector3(0,0,0), camUp = new THREE.Vector3(0,1,0);
let fRotX = 0, fRotY = 0, curAlpha = 1.0;
// Focus state variables for camera control
let fDist = 8.0;
let fPan = new THREE.Vector3(0,0,0);
        
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
        
// --- TIMELINE SEQUENCER ---
const startTime = Date.now();
let introPhase = 0; 
let glitchStartTime = null;

// 设置 audioManager 为全局变量
window.audioManager = audioManager;
        
// 设置 userSystem 的依赖（updateResonanceGeometry 和 uiManager）
setUserSystemDependencies(updateResonanceGeometry, uiManager);

window.addEventListener('resize', ()=>{ camera.aspect=window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });

const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    updateIntro(); 
    if (introPhase < 3) {
        renderer.render(scene, camera);
        return; 
    }
    const dt = clock.getDelta();
            
    // Check if UI overlay is active to pause interaction
    const isUIActive = document.getElementById('overlay-container').classList.contains('active');

    if(!isFocused && !isDrag && !isPan && !isPaused && !isUIActive) { 
        simTime+=dt; 
        trY+=0.0005; 
        trX+=0.0002; 
    }
            
    particleMaterial.uniforms.uTime.value=simTime;
    albums.forEach(g=>{
        const m=g.userData.innerMesh;
        if(!isFocused && !isDrag && !isPan && !isPaused && !isUIActive) { 
            g.userData.u+=dt*0.15; 
            if(g.userData.u>Math.PI*4) g.userData.u-=Math.PI*4; 
        }
                
        const pos=getMobiusPos(g.userData.u, g.userData.offsetY), look=getMobiusPos(g.userData.u+0.1, g.userData.offsetY);
        g.position.copy(pos); g.lookAt(look); g.rotateY(Math.PI/2); g.rotateX(g.userData.u*0.5);
        if(g.userData.posIndex%2===1) g.rotateX(Math.PI);
        const tf=g.userData.isFlipped?Math.PI:0; m.rotation.y+=(tf-m.rotation.y)*0.1;
        let ts=1.0; if(isFocused) ts=(g===focusedAlbum)?1.2:0.8; 
        g.userData.currentScale+=(ts-g.userData.currentScale)*0.1; g.scale.setScalar(g.userData.currentScale);
                
        // Blink logic
        if (g.userData.resonanceParticles && g.userData.resonanceParticles.visible) {
            const setParticleOpacity = (opacity) => {
                g.userData.resonanceParticles.traverse(obj => {
                    if (obj.material) obj.material.opacity = opacity;
                });
            };
            if (window.audioManager.isPlaying && window.audioManager.currentTrackData === g.userData) {
                 const speedFactor = (window.userSystem.userBlinkSpeed / 100) * PARTICLE_BLINK_SPEED_MAX;
                 const center = (PARTICLE_OPACITY_MAX + PARTICLE_OPACITY_MIN) / 2;
                 const amp = (PARTICLE_OPACITY_MAX - PARTICLE_OPACITY_MIN) / 2;
                 if (speedFactor <= 0.1) {
                     setParticleOpacity(PARTICLE_OPACITY_BASE);
                 } else {
                     const time = Date.now() * 0.005;
                     setParticleOpacity(center + Math.sin(time * speedFactor) * amp);
                 }
            } else {
                 setParticleOpacity(PARTICLE_OPACITY_BASE); 
            }
        }
        g.updateMatrixWorld();
    });
    if(!isFocused) {
        scene.rotation.y = THREE.MathUtils.lerp(scene.rotation.y, trY, 0.05);
        scene.rotation.x = THREE.MathUtils.lerp(scene.rotation.x, trX, 0.05);
        camera.position.lerp(camT, 0.05); camera.lookAt(camL); camera.up.lerp(camUp, 0.05);
        if(!isPan && !isUIActive) { camera.position.x+=(mX*5-(camera.position.x-camT.x))*0.01; camera.position.y+=(mY*5-(camera.position.y-camT.y))*0.01; }
    } else if(focusedAlbum) {
        const wp=new THREE.Vector3(); focusedAlbum.getWorldPosition(wp);
        const wq=new THREE.Quaternion(); focusedAlbum.getWorldQuaternion(wq);
                
        const viewRot = new THREE.Euler(fRotX, fRotY, 0, 'YXZ');
        const panVec = new THREE.Vector3(-fPan.x, fPan.y, 0);
        panVec.applyEuler(viewRot);
        panVec.applyQuaternion(wq);
        const targetFocus = wp.clone().add(panVec);

        const distVec = new THREE.Vector3(0, 0, fDist);
        distVec.applyEuler(viewRot);
        distVec.applyQuaternion(wq);
        const targetCamPos = targetFocus.clone().add(distVec);

        const tu=new THREE.Vector3(0,1,0).applyQuaternion(wq);
                
        camera.position.lerp(targetCamPos, 0.1); 
        camera.lookAt(targetFocus); 
        camera.up.lerp(tu, 0.1);
    }
    renderer.render(scene, camera);
}

function updateIntro() {
    console.log('updateIntro 被调用, introPhase:', introPhase);
    
    if (introPhase === 3) {
         if (introTitleMesh.visible) introTitleMesh.visible = false;
         console.log('introPhase 已为 3，进入主页面');
         return;
    }

    const now = Date.now();
    const elapsedSinceLoad = (now - startTime) / 1000;
            
    introRadioMat.uniforms.uTime.value = elapsedSinceLoad;
    introTitleMat.uniforms.uTime.value = elapsedSinceLoad;
    fsNoiseMat.uniforms.uTime.value = elapsedSinceLoad;

    if (introPhase === 0) {
        console.log('introPhase 为 0，显示初始画面');
        introRadioMesh.position.y = Math.sin(elapsedSinceLoad * 1.5) * 0.5;
    } else if (introPhase === 1) {
        console.log('introPhase 为 1，播放故障动画');
        if (!glitchStartTime) {
            glitchStartTime = Date.now();
            console.log('glitchStartTime 未初始化，重新设置:', glitchStartTime);
        }
        const elapsedGlitch = (now - glitchStartTime) / 1000;
        console.log('elapsedGlitch:', elapsedGlitch);
                
        let radioStrength = 0;
        let radioOpacity = 1.0;
        let radioDarkness = 0.0;
                
        if (elapsedGlitch < 0.6) {
            radioStrength = 0.0;
        } else if (elapsedGlitch < 1.4) {
            const intensity = (elapsedGlitch - 0.6) / 0.8; 
            radioStrength = 5.0 + intensity * 40.0;
        } 
                
        if (elapsedGlitch > 1.4) {
            const fadeProgress = (elapsedGlitch - 1.4) / 0.5;
            radioOpacity = Math.max(0.0, 1.0 - fadeProgress);
            radioDarkness = Math.min(1.0, fadeProgress);
            radioStrength = 45.0; 
        }

        if (elapsedGlitch > 0.5) {
            const fsIntensity = Math.min(1, (elapsedGlitch - 0.5) / 0.7);
            fsNoiseMat.uniforms.uOpacity.value = fsIntensity * 0.5; 
            fsNoiseMat.uniforms.uGlitchStrength.value = 10.0 + fsIntensity * 20.0;
                    
            if (elapsedGlitch > 1.4) {
                const darkness = Math.min(1.0, (elapsedGlitch - 1.4) / 0.5);
                fsNoiseMat.uniforms.uDarkness.value = darkness;
                fsNoiseMat.uniforms.uOpacity.value = 0.5 * (1.0 - darkness);
            }
                    
            if (!document.body.classList.contains('glitch-active')) {
                document.body.classList.add('glitch-active');
            }
        }
                
        if (elapsedGlitch > 1.7) {
             const titleProgress = (elapsedGlitch - 1.7) / 0.2;
             introTitleMat.uniforms.uOpacity.value = Math.min(1.0, titleProgress);
        }

        introRadioMat.uniforms.uGlitchStrength.value = radioStrength;
        introRadioMat.uniforms.uOpacity.value = radioOpacity;
        introRadioMat.uniforms.uDarkness.value = radioDarkness;

        const shakeMag = 0.5 + (elapsedGlitch / 1.9) * 4.0;
        introRadioMesh.position.x = (Math.random() - 0.5) * shakeMag;
        introRadioMesh.position.y = (Math.random() - 0.5) * shakeMag;

        console.log('检查是否进入 phase 2，elapsedGlitch > 1.9:', elapsedGlitch > 1.9);
        if (elapsedGlitch > 1.9) {
            console.log('进入 introPhase 2');
            introPhase = 2;
            introRadioMesh.visible = false;
            fsPlane.visible = false;
            document.body.classList.remove('glitch-active');
        }

    } else if (introPhase === 2) {
        console.log('introPhase 为 2，播放标题动画');
        // 在进入 phase 2 时重新设置 glitchStartTime，确保 phase2Time 从 0 开始计算
        if (window.phase2Started === undefined) {
            window.phase2Started = Date.now();
            console.log('phase2Started 初始化:', window.phase2Started);
        }
        const phase2Time = (now - window.phase2Started) / 1000;
        console.log('phase2Time:', phase2Time);
                
        if (phase2Time < 0.4) {
            introTitleMat.uniforms.uOpacity.value = Math.min(1.0, 0.5 + (phase2Time / 0.4) * 0.5);
        } 
        else if (phase2Time < 1.4) {
            introTitleMat.uniforms.uOpacity.value = 1.0;
        }
        else if (phase2Time < 1.8) {
            introTitleMat.uniforms.uOpacity.value = Math.max(0, 1.0 - (phase2Time - 1.4) / 0.4);
        }
                
        console.log('检查是否进入 phase 3，phase2Time > 1.8:', phase2Time > 1.8);
        if (phase2Time > 1.8) {
            console.log('进入 introPhase 3，显示主页面');
            introPhase = 3;
            albumGroup.visible = true;
            particleSystem.visible = true;
            document.querySelectorAll('.ui-element').forEach(el => el.classList.add('fade-in'));
            console.log('albumGroup.visible:', albumGroup.visible);
            console.log('particleSystem.visible:', particleSystem.visible);
        }
    }
}
        
function startExperience() {
    console.log('startExperience 被调用, introPhase:', introPhase);
    if (introPhase !== 0) return;
    // 重置 phase2Started 变量，确保 phase 2 从新的时间开始计算
    window.phase2Started = undefined;
    // 强制设置 introPhase 为 1，忽略条件判断
    introPhase = 1;
    glitchStartTime = Date.now();
    const hintEl = document.getElementById('intro-hint');
    if (hintEl) {
        hintEl.style.display = 'none';
    }
    console.log('✓ Intro 动画开始，强制启动');
    console.log('当前时间:', Date.now());
    console.log('glitchStartTime:', glitchStartTime);
}
        
// 保留事件监听器，同时添加更多调试信息
document.body.addEventListener('click', (e) => {
    console.log('点击事件触发, target:', e.target);
    console.log('点击时间:', Date.now());
    console.log('当前 introPhase:', introPhase);
    startExperience();
});
document.body.addEventListener('touchstart', (e) => {
    console.log('触摸事件触发');
    startExperience();
});

// 启动时的调试信息
console.log('=== Möbius Radio 初始化 ===');
console.log('Three.js 版本:', THREE.REVISION);
console.log('相机位置:', camera.position);
console.log('introGroup 位置:', introGroup.position);
console.log('introRadioMesh 位置:', introRadioMesh.position);
console.log('introPhase 初始值:', introPhase);
console.log('等待用户点击以开始...');

function isCanvasInteractionBlocked(e) {
    if (memoryCards.editing) return true;
    const target = e.target;
    return target && (target.closest('.control-btn') || target.closest('#resonate-btn') || target.closest('#track-play-btn') || target.closest('#memory-editor') || target.closest('#overlay-container') || target.closest('.progress-container') || target.closest('#top-bar') || target.closest('#main-progress-wrapper') || target.closest('#mini-player'));
}
function onStart(e) { if(isCanvasInteractionBlocked(e)) return; if(e.button===0) isDrag=true; else if(e.button===1) isPan=true; dragS={x:e.clientX,y:e.clientY}; lastM={x:e.clientX,y:e.clientY}; }
function onEnd(e) { if(isCanvasInteractionBlocked(e)) return; if(isDrag) { isDrag=false; if(Math.sqrt(Math.pow(e.clientX-dragS.x,2)+Math.pow(e.clientY-dragS.y,2))<10 && e.button===0) handleClick(e.clientX,e.clientY); } if(isPan) isPan=false; }
function onMove(e) { if(isCanvasInteractionBlocked(e)) return; const dx=e.clientX-lastM.x, dy=e.clientY-lastM.y; mX=(e.clientX/window.innerWidth)*2-1; mY=-(e.clientY/window.innerHeight)*2+1; 
    if(isDrag) { 
        if(!isFocused){ trY+=dx*0.005; trX+=dy*0.005; } 
        else { fRotY-=dx*0.005; fRotX-=dy*0.005; fRotX=Math.max(-1.5, Math.min(1.5,fRotX)); } 
    } else if(isPan) { 
        if (!isFocused) {
            camT.x-=dx*0.05; camT.y+=dy*0.05; camL.x-=dx*0.05; camL.y+=dy*0.05; 
        } else {
            const sensitivity = 0.01 * (fDist / 8.0); 
            fPan.x -= dx * sensitivity;
            fPan.y += dy * sensitivity;
        }
    } 
    lastM={x:e.clientX,y:e.clientY}; 
}
        
document.addEventListener('mousedown', onStart); document.addEventListener('mouseup', onEnd); document.addEventListener('mousemove', onMove);
document.addEventListener('touchstart', e=>onStart({button:0,clientX:e.touches[0].clientX,clientY:e.touches[0].clientY}), {passive:false});
document.addEventListener('touchend', e=>onEnd({button:0,clientX:e.changedTouches[0].clientX,clientY:e.changedTouches[0].clientY}));
document.addEventListener('touchmove', e=>{onMove({clientX:e.touches[0].clientX,clientY:e.touches[0].clientY});e.preventDefault();}, {passive:false});
        
// --- 【修改滚轮事件逻辑】支持聚焦模式下的缩放 ---
document.addEventListener('wheel', e => {
    e.preventDefault();
    if (memoryCards.editing) return;
    if (!isFocused) {
        camT.z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, camT.z + e.deltaY * 0.1));
    } else {
        fDist = Math.max(2.0, Math.min(100.0, fDist + e.deltaY * 0.05));
    }
}, { passive: false });
        
document.getElementById('reset-btn').onclick = (e) => { e.stopPropagation(); resetGlobalView(); };
document.getElementById('play-pause-btn').onclick = (e) => { e.stopPropagation(); isPaused=!isPaused; document.getElementById('icon-pause').style.display=isPaused?'none':'block'; document.getElementById('icon-play').style.display=isPaused?'block':'none'; };

function handleClick(cx, cy) {
    if (introPhase < 3) return;
            
    const overlay = document.getElementById('overlay-container');
    if (overlay.classList.contains('active')) {
        return;
    }

    mouse.x=(cx/window.innerWidth)*2-1; mouse.y=-(cy/window.innerHeight)*2+1;
    ray.setFromCamera(mouse, camera);
    const hits = ray.intersectObjects(albums.map(g=>g.userData.innerMesh));
    if(hits.length>0) {
        const g = hits[0].object.parent.parent; 
        const target = hits[0].object.parent;
        if(!isFocused) focusOnAlbum(target);
        else { if(target===focusedAlbum) toggleFlip(target); else { resetGlobalView(); focusOnAlbum(target); } }
    } else if(isFocused) resetGlobalView();
}

function toggleFlip(g) {
    if (!window.userSystem.isLoggedIn) return;
    if (!g.userData.isFlipped) {
        g.userData.isFlipped = true;
        if (g.userData.overlayMesh) g.userData.overlayMesh.visible = true;
        return;
    }
    memoryCards.openEditor(g);
}
function resetFlip(g) { if(!g)return; g.userData.isFlipped=false; if(g.userData.overlayMesh) g.userData.overlayMesh.visible=false; g.userData.innerMesh.rotation.y=0; }
function resetGlobalView() {
    if(focusedAlbum) resetFlip(focusedAlbum);
    albums.forEach(g=>{ g.visible=true; g.userData.innerMesh.renderOrder=0; if(Array.isArray(g.userData.innerMesh.material)) g.userData.innerMesh.material.forEach(m=>m.depthTest=true); else g.userData.innerMesh.material.depthTest=true; });
    isFocused=false; focusedAlbum=null; camT.set(0, DEFAULT_CAM_Y, DEFAULT_CAM_Z); camL.set(0,0,0); camUp.set(0,1,0); trX=0; trY=0;
    audioManager.albumLabelEl.style.opacity='0'; 
    audioManager.hideButton(); 
    audioManager.hideResonateButton();
    audioManager.hideProgress(); 
            
    if(audioManager.isPlaying || (audioManager.audioEl.src && !audioManager.audioEl.paused)) {
        audioManager.showMiniPlayer(); 
    } else if (audioManager.currentTrackData) {
        audioManager.showMiniPlayer(); 
    }
}
function focusOnAlbum(g) {
    isFocused=true; focusedAlbum=g; fRotX=0; fRotY=0;
            
    audioManager.hideMiniPlayer();
    audioManager.updateCurrentInfo(g.userData);
            
    fDist = 8.0; 
    fPan.set(0,0,0); 

    const wp=new THREE.Vector3(); g.getWorldPosition(wp); const wq=new THREE.Quaternion(); g.getWorldQuaternion(wq);
    const wn=new THREE.Vector3(0,0,1).applyQuaternion(wq), wu=new THREE.Vector3(0,1,0).applyQuaternion(wq);
    camL.copy(wp); camT.copy(wp).add(wn.multiplyScalar(8.0)); camUp.copy(wu);
    albums.forEach(x=>x.visible=true);
    const cpts=[new THREE.Vector3(0,0,0), new THREE.Vector3(1.8,1.8,0), new THREE.Vector3(-1.8,1.8,0)];
    const tMesh=g.userData.innerMesh; const blockers=new Set();
    cpts.forEach(p=>{
        const tp=p.clone().applyMatrix4(tMesh.matrixWorld); const dir=new THREE.Vector3().subVectors(tp, camT).normalize();
        const rayOc=new THREE.Raycaster(camT, dir); rayOc.far=camT.distanceTo(tp)+0.1;
        const hits=rayOc.intersectObjects(albums.map(a=>a.userData.innerMesh));
        for(let h of hits) { if(h.object!==tMesh) blockers.add(h.object.parent); else break; }
    });
    blockers.forEach(b=>b.visible=false);
    const l=g.userData.labelText, inf=albumData[l]||{title:`ALBUM ${l}`,artist:`ARTIST ${g.userData.groupId}`};
            
    audioManager.albumLabelEl.querySelector('#album-title-text').innerHTML=inf.title;
    audioManager.albumLabelEl.querySelector('#album-artist-text').innerHTML=`<span class="artist-name">${inf.artist}</span><span class="album-year">${inf.year}</span>`;
    audioManager.albumLabelEl.style.opacity='1';

    if (window.userSystem.isLoggedIn) {
        audioManager.showResonateButton(g);
        audioManager.checkAndSetupAudio(g.userData.groupId, g.userData.labelText);
    } else {
        audioManager.hideButton();
        audioManager.hideResonateButton();
    }
}

animate();
