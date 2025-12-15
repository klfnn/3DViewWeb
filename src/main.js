/**
 * Head-tracking parallax room using MediaPipe FaceLandmarker.
 */
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const video = document.getElementById('video');
const container = document.getElementById('container');
const startBtn = document.getElementById('start-btn');
const videoContainer = document.getElementById('video-container');
const trackingStatus = document.getElementById('tracking-status');
const positionInfo = document.getElementById('position-info');
const calibrateBtn = document.getElementById('calibrate-btn');
const stopBtn = document.getElementById('stop-btn');
const toggleVideoCheckbox = document.getElementById('toggle-video-checkbox');
const modelCanvas = document.getElementById('model-canvas');

let isTracking = false;
let currentStream = null;

// --- Three.js 설정 ---
let threeScene, threeCamera, threeRenderer, lightstickModel;
let modelRotation = 0;

function initThree() {
    const canvas = modelCanvas;
    // 초기 크기 (모델 로드 후 조정됨)
    let w = canvas.clientWidth || 300;
    let h = canvas.clientHeight || 400;

    threeScene = new THREE.Scene();
    threeCamera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    threeCamera.position.set(0, 0.5, 3.3);
    threeCamera.lookAt(0, 0.3, 0);

    threeRenderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    threeRenderer.setSize(w, h);
    threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    threeRenderer.outputColorSpace = THREE.SRGBColorSpace;

    // 조명
    const ambient = new THREE.AmbientLight(0xffffff, 1.0);
    threeScene.add(ambient);
    const directional = new THREE.DirectionalLight(0xffffff, 1.5);
    directional.position.set(2, 3, 2);
    threeScene.add(directional);
    const backLight = new THREE.DirectionalLight(0xffffff, 0.5);
    backLight.position.set(-2, 1, -2);
    threeScene.add(backLight);

    // GLB 모델 로드
    const loader = new GLTFLoader();
    loader.load(
        '/3dmodel/newjeans_lightstick_3d_model.glb',
        (gltf) => {
            lightstickModel = gltf.scene;
            lightstickModel.scale.set(2.4, 2.4, 2.4);
            lightstickModel.position.set(0, 0, 0);
            threeScene.add(lightstickModel);

            // 바운딩 박스 계산해서 캔버스 크기 동적 조정
            const box = new THREE.Box3().setFromObject(lightstickModel);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            // 모델 중심으로 카메라 조정
            threeCamera.lookAt(center);

            // 모델이 화면에 맞게 캔버스 크기 계산
            const fov = threeCamera.fov * (Math.PI / 180);
            const dist = threeCamera.position.z - center.z;
            const visibleHeight = 2 * Math.tan(fov / 2) * dist;
            const visibleWidth = visibleHeight * threeCamera.aspect;

            // 모델 크기에 여유(padding 20%) 두고 캔버스 크기 결정
            const padding = 1.2;
            const neededW = (size.x / visibleWidth) * w * padding;
            const neededH = (size.y / visibleHeight) * h * padding;

            // 최소/최대 제한
            const finalW = Math.min(Math.max(neededW, 200), window.innerWidth * 0.7);
            const finalH = Math.min(Math.max(neededH, 250), window.innerHeight * 0.8);

            // 캔버스 및 렌더러 크기 업데이트
            canvas.style.width = `${finalW}px`;
            canvas.style.height = `${finalH}px`;
            threeRenderer.setSize(finalW, finalH);
            threeCamera.aspect = finalW / finalH;
            threeCamera.updateProjectionMatrix();

            console.log(`모델 로드 완료, 캔버스 크기: ${Math.round(finalW)}x${Math.round(finalH)}`);
        },
        undefined,
        (err) => console.error('GLB 로드 실패:', err)
    );
}

function animateThree() {
    requestAnimationFrame(animateThree);
    if (lightstickModel) {
        modelRotation += 0.008;
        lightstickModel.rotation.y = modelRotation;
    }
    if (threeRenderer && threeScene && threeCamera) {
        threeRenderer.render(threeScene, threeCamera);
    }
}

initThree();
animateThree();

function showFatal(msg) {
    trackingStatus.textContent = msg;
    trackingStatus.className = 'off';
    startBtn.textContent = '다시 시도';
    startBtn.disabled = false;
}

window.addEventListener('error', (e) => {
    console.error('window.error:', e);
    showFatal(`오류: ${e?.message || '스크립트 오류'}`);
});
window.addEventListener('unhandledrejection', (e) => {
    console.error('unhandledrejection:', e?.reason);
    showFatal(`오류: ${e?.reason?.message || 'Promise 오류'}`);
});

// --- Physical screen calibration ---
const viewingDistanceCm = 55;
const screenDiagonalIn = 14;
const screenAspectW = 16;
const screenAspectH = 10;
const parallaxScaleX = -1.0;
const parallaxScaleY = 0.6;

function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
}
function softClamp(px, max) {
    return max * Math.tanh(px / Math.max(1e-6, max));
}
function screenMm() {
    const d = screenDiagonalIn * 25.4;
    const r = Math.hypot(screenAspectW, screenAspectH);
    return { wMm: d * (screenAspectW / r), hMm: d * (screenAspectH / r) };
}
function computeFovDeg() {
    const d = screenDiagonalIn * 25.4;
    const r = Math.hypot(screenAspectW, screenAspectH);
    const hMm = d * (screenAspectH / r);
    return clamp((2 * Math.atan(hMm / 2 / Math.max(200, viewingDistanceCm * 10)) * 180) / Math.PI, 12, 35);
}

function updatePerspective() {
    const h = Math.max(1, window.innerHeight);
    const fovRad = (computeFovDeg() * Math.PI) / 180;
    const p = h / 2 / Math.tan(fovRad / 2);
    container.style.perspective = `${Math.round(p)}px`;
    document.documentElement.style.setProperty('--depth', `${Math.round(clamp(p * 0.3, 340, 720))}px`);
    document.documentElement.style.setProperty(
        '--grid',
        `${Math.round(clamp(Math.min(window.innerWidth, h) / 16, 45, 90))}px`
    );
}
updatePerspective();
window.addEventListener('resize', updatePerspective);

let lastOriginX = -1e9,
    lastOriginY = -1e9;
function updateScene(xPx, yPx) {
    const w = Math.max(1, window.innerWidth),
        h = Math.max(1, window.innerHeight);
    const originX = clamp(w / 2 + softClamp(xPx, w * 0.42), w * 0.06, w * 0.94);
    const originY = clamp(h / 2 + softClamp(yPx, h * 0.34), h * 0.08, h * 0.92);
    if (Math.abs(originX - lastOriginX) < 0.08 && Math.abs(originY - lastOriginY) < 0.08) return;
    lastOriginX = originX;
    lastOriginY = originY;
    container.style.perspectiveOrigin = `${originX.toFixed(1)}px ${originY.toFixed(1)}px`;
}

// --- Render loop (always 60fps) ---
let smoothX = 0,
    smoothY = 0,
    targetX = 0,
    targetY = 0,
    displayX = 0,
    displayY = 0;
const responseMs = 30,
    visualMs = 10;
let rafId = 0,
    lastMs = 0;

function renderTick(now) {
    if (!isTracking) return;
    if (!lastMs) lastMs = now;
    const dt = now - lastMs;
    lastMs = now;

    // 예측: 감지 사이에 속도 기반으로 부드럽게 보간
    const dtSec = dt / 1000;
    const { wMm, hMm } = screenMm();
    const predX = velocityX * dtSec * 0.4; // 예측량 (40%만 적용)
    const predY = velocityY * dtSec * 0.4;

    // 속도 감쇠
    velocityX *= velocityDecay;
    velocityY *= velocityDecay;

    // 예측을 타겟에 적용
    const predTargetX = targetX + (predX / (wMm / window.innerWidth)) * parallaxScaleX;
    const predTargetY = targetY + (predY / (hMm / window.innerHeight)) * parallaxScaleY;

    const a1 = 1 - Math.exp(-dt / responseMs);
    smoothX += (predTargetX - smoothX) * a1;
    smoothY += (predTargetY - smoothY) * a1;

    const a2 = 1 - Math.exp(-dt / visualMs);
    displayX += (smoothX - displayX) * a2;
    displayY += (smoothY - displayY) * a2;

    updateScene(displayX, displayY);
    rafId = requestAnimationFrame(renderTick);
}
function startRender() {
    stopRender();
    lastMs = 0;
    displayX = smoothX;
    displayY = smoothY;
    lastOriginX = lastOriginY = -1e9;
    rafId = requestAnimationFrame(renderTick);
}
function stopRender() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
}

// --- Face detection with MediaPipe FaceLandmarker ---
let faceLandmarker = null;

// 파이어폭스 감지 (WebGL 느림)
const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');

async function loadModels() {
    if (faceLandmarker) return;
    trackingStatus.textContent = '모델 로딩...';

    const filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );

    faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
            modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        minFaceDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
    });
}

// Estimate head position from landmarks
const assumedFaceWidthMm = 140; // average face width
let baselineMm = { x: 0, y: 0, set: false };
let lastHeadMm = { x: 0, y: 0, z: 550 };

// Jitter 필터: 원시 감지값을 스무딩
let smoothHeadX = 0,
    smoothHeadY = 0;
let velocityX = 0,
    velocityY = 0;
let lastDetectTime = 0;
const headSmoothAlpha = 0.55; // 클수록 더 빠른 반응
const deadzoneMm = 1.5; // 이 이하 변화는 무시
const velocityDecay = 0.92; // 속도 감쇠

function estimateHead(landmarks, vw, vh) {
    // 코 끝 (landmark 1)과 얼굴 좌우 끝 (234, 454)
    const nose = landmarks[1];
    const leftCheek = landmarks[234];
    const rightCheek = landmarks[454];

    const cx = nose.x * vw;
    const cy = nose.y * vh;
    const faceW = Math.abs(rightCheek.x - leftCheek.x) * vw;

    // mm per pixel based on face width
    const mmPerPx = assumedFaceWidthMm / Math.max(10, faceW);
    const xMm = (cx - vw / 2) * mmPerPx;
    const yMm = (cy - vh / 2) * mmPerPx;

    // rough z estimate
    const zMm = clamp((assumedFaceWidthMm * vw * 0.3) / Math.max(10, faceW), 300, 1200);

    return {
        xMm: clamp(xMm, -150, 150),
        yMm: clamp(yMm, -120, 120),
        zMm,
    };
}

// --- Detection loop ---
let detectActive = false;
let lastUiMs = 0;
const uiEveryMs = 120;
let lastFacePresent = false;
let lastVideoTime = -1;
let lastDetectMs = 0;
const detectIntervalMs = 33; // ~30fps 감지 (매 프레임 대신)

function detectLoop() {
    if (!detectActive || !isTracking) return;

    if (!video.videoWidth || video.readyState < 2) {
        requestAnimationFrame(detectLoop);
        return;
    }

    // 감지 간격 제한 (~30fps)
    const now = performance.now();
    if (now - lastDetectMs < detectIntervalMs) {
        requestAnimationFrame(detectLoop);
        return;
    }
    lastDetectMs = now;

    // 같은 프레임이면 스킵
    if (video.currentTime === lastVideoTime) {
        requestAnimationFrame(detectLoop);
        return;
    }
    lastVideoTime = video.currentTime;

    try {
        const result = faceLandmarker.detectForVideo(video, performance.now());

        if (result.faceLandmarks && result.faceLandmarks.length > 0) {
            const landmarks = result.faceLandmarks[0];
            const vw = video.videoWidth,
                vh = video.videoHeight;
            const head = estimateHead(landmarks, vw, vh);
            lastHeadMm = head;

            if (!baselineMm.set) {
                baselineMm = { x: head.xMm, y: head.yMm, set: true };
                smoothHeadX = head.xMm;
                smoothHeadY = head.yMm;
            }

            // Jitter 필터: 원시 값을 스무딩 + 속도 계산
            const now = performance.now();
            const dtDetect = lastDetectTime ? (now - lastDetectTime) / 1000 : 0.033;
            lastDetectTime = now;

            const prevX = smoothHeadX;
            const prevY = smoothHeadY;
            smoothHeadX += (head.xMm - smoothHeadX) * headSmoothAlpha;
            smoothHeadY += (head.yMm - smoothHeadY) * headSmoothAlpha;

            // 속도 업데이트 (mm/s)
            if (dtDetect > 0.001) {
                const newVelX = (smoothHeadX - prevX) / dtDetect;
                const newVelY = (smoothHeadY - prevY) / dtDetect;
                velocityX = velocityX * 0.5 + newVelX * 0.5;
                velocityY = velocityY * 0.5 + newVelY * 0.5;
            }

            const { wMm, hMm } = screenMm();
            let xAdj = smoothHeadX - baselineMm.x;
            let yAdj = smoothHeadY - baselineMm.y;

            // Deadzone: 미세 변화 무시
            if (Math.abs(xAdj) < deadzoneMm) xAdj = 0;
            if (Math.abs(yAdj) < deadzoneMm) yAdj = 0;

            targetX = (xAdj / (wMm / window.innerWidth)) * parallaxScaleX;
            targetY = (yAdj / (hMm / window.innerHeight)) * parallaxScaleY;

            if (!lastFacePresent) {
                trackingStatus.textContent = '추적 중';
                trackingStatus.className = 'on';
                lastFacePresent = true;
            }

            const nowUi = performance.now();
            if (nowUi - lastUiMs > uiEveryMs) {
                lastUiMs = nowUi;
                positionInfo.textContent = `X:${targetX.toFixed(0)} Y:${targetY.toFixed(0)} Z≈${Math.round(head.zMm)}`;
            }
        } else {
            if (lastFacePresent) {
                trackingStatus.textContent = '얼굴 찾는 중...';
                trackingStatus.className = 'off';
                lastFacePresent = false;
            }
        }
    } catch (err) {
        console.error('detect error:', err);
    }

    // 다음 프레임
    if (detectActive && isTracking) {
        requestAnimationFrame(detectLoop);
    }
}

function startDetect() {
    detectActive = true;
    lastFacePresent = false;
    lastVideoTime = -1;
    detectLoop();
}
function stopDetect() {
    detectActive = false;
}

// --- Start / Stop ---
async function start() {
    startBtn.textContent = '로딩 중...';
    startBtn.disabled = true;

    if (!navigator.mediaDevices?.getUserMedia) {
        showFatal('카메라 미지원');
        return;
    }

    try {
        await loadModels();
    } catch (e) {
        console.error(e);
        showFatal('모델 로딩 실패');
        return;
    }

    try {
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 30 }, facingMode: 'user' },
            });
        } catch {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
        currentStream = stream;
        video.srcObject = stream;
        await video.play();

        startBtn.style.display = 'none';
        videoContainer.style.display = 'block';
        trackingStatus.textContent = '감지 중';
        trackingStatus.className = 'on';

        isTracking = true;
        baselineMm = { x: 0, y: 0, set: false };
        lastFacePresent = false;
        lastUiMs = 0;
        targetX = targetY = smoothX = smoothY = displayX = displayY = 0;

        startRender();
        startDetect();
    } catch (err) {
        console.error('camera error:', err);
        showFatal('카메라 접근 실패');
    }
}

function stopCamera() {
    isTracking = false;
    stopDetect();
    stopRender();

    if (currentStream) {
        for (const t of currentStream.getTracks()) t.stop();
    }
    currentStream = null;
    video.pause();
    video.srcObject = null;

    videoContainer.style.display = 'none';
    startBtn.style.display = 'block';
    startBtn.textContent = '시작하기';
    startBtn.disabled = false;

    trackingStatus.textContent = '대기 중';
    trackingStatus.className = 'off';
    positionInfo.textContent = '';

    baselineMm = { x: 0, y: 0, set: false };
    smoothX = smoothY = displayX = displayY = targetX = targetY = 0;
    updateScene(0, 0);
}

// Mouse fallback
document.addEventListener('mousemove', (e) => {
    if (isTracking) return;
    targetX = e.clientX - window.innerWidth / 2;
    targetY = e.clientY - window.innerHeight / 2;
});

calibrateBtn.addEventListener('click', () => {
    if (!isTracking) return;
    // 현재 스무딩된 위치를 기준점으로 설정
    baselineMm = { x: smoothHeadX, y: smoothHeadY, set: true };
    // 타겟, 스무딩, 속도 모두 리셋
    targetX = targetY = 0;
    smoothX = smoothY = 0;
    displayX = displayY = 0;
    velocityX = velocityY = 0;
});

toggleVideoCheckbox.addEventListener('change', () => {
    videoContainer.style.display = toggleVideoCheckbox.checked ? 'block' : 'none';
});

// 크레딧 모달
const creditLink = document.getElementById('credit-link');
const creditModal = document.getElementById('credit-modal');
const creditCloseBtn = document.getElementById('credit-close-btn');

creditLink.addEventListener('click', () => {
    creditModal.classList.add('show');
});

creditCloseBtn.addEventListener('click', () => {
    creditModal.classList.remove('show');
});

creditModal.addEventListener('click', (e) => {
    if (e.target === creditModal) {
        creditModal.classList.remove('show');
    }
});

stopBtn.addEventListener('click', stopCamera);
startBtn.addEventListener('click', start);
