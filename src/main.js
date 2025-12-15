/**
 * Head-tracking parallax room using MediaPipe FaceLandmarker.
 */
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { BVHLoader } from 'three/addons/loaders/BVHLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';

const video = document.getElementById('video');
const container = document.getElementById('container');
const startBtn = document.getElementById('start-btn');
const videoContainer = document.getElementById('video-container');
const trackingStatus = document.getElementById('tracking-status');
const positionInfo = document.getElementById('position-info');
const calibrateBtn = document.getElementById('calibrate-btn');
const stopBtn = document.getElementById('stop-btn');
const toggleVideoCheckbox = document.getElementById('toggle-video-checkbox');
const modelRotateCheckbox = document.getElementById('model-rotate-checkbox');
const modelCanvas = document.getElementById('model-canvas');

let isTracking = false;
let currentStream = null;

// --- Three.js 설정 ---
let threeScene, threeCamera, threeRenderer, lightstickModel;
let modelRotation = 0;
let currentVrm = null;
let modelMixer = null;
let modelAutoRotate = false;
let modelYOffset = 0;
let modelAngle = 0;
let modelScaleFactor = 1;
let baseModelScale = new THREE.Vector3(1, 1, 1);
let baseModelY = 0;
let currentAnimationAction = null;
let lastMotionFile = null; // 마지막 모션 파일 저장
let shadowPlane = null; // 그림자 평면

// VRM 본 이름 매핑 (Mixamo/일반 FBX -> VRM)
const boneMapping = {
    mixamorigHips: 'hips',
    mixamorigSpine: 'spine',
    mixamorigSpine1: 'chest',
    mixamorigSpine2: 'upperChest',
    mixamorigNeck: 'neck',
    mixamorigHead: 'head',
    mixamorigLeftShoulder: 'leftShoulder',
    mixamorigLeftArm: 'leftUpperArm',
    mixamorigLeftForeArm: 'leftLowerArm',
    mixamorigLeftHand: 'leftHand',
    mixamorigRightShoulder: 'rightShoulder',
    mixamorigRightArm: 'rightUpperArm',
    mixamorigRightForeArm: 'rightLowerArm',
    mixamorigRightHand: 'rightHand',
    mixamorigLeftUpLeg: 'leftUpperLeg',
    mixamorigLeftLeg: 'leftLowerLeg',
    mixamorigLeftFoot: 'leftFoot',
    mixamorigLeftToeBase: 'leftToes',
    mixamorigRightUpLeg: 'rightUpperLeg',
    mixamorigRightLeg: 'rightLowerLeg',
    mixamorigRightFoot: 'rightFoot',
    mixamorigRightToeBase: 'rightToes',
    // 일반 본 이름
    Hips: 'hips',
    Spine: 'spine',
    Spine1: 'chest',
    Spine2: 'upperChest',
    Neck: 'neck',
    Head: 'head',
    LeftShoulder: 'leftShoulder',
    LeftArm: 'leftUpperArm',
    LeftForeArm: 'leftLowerArm',
    LeftHand: 'leftHand',
    RightShoulder: 'rightShoulder',
    RightArm: 'rightUpperArm',
    RightForeArm: 'rightLowerArm',
    RightHand: 'rightHand',
    LeftUpLeg: 'leftUpperLeg',
    LeftLeg: 'leftLowerLeg',
    LeftFoot: 'leftFoot',
    LeftToeBase: 'leftToes',
    RightUpLeg: 'rightUpperLeg',
    RightLeg: 'rightLowerLeg',
    RightFoot: 'rightFoot',
    RightToeBase: 'rightToes',
};

function initThree() {
    const canvas = modelCanvas;
    let w = window.innerWidth;
    let h = window.innerHeight;

    threeScene = new THREE.Scene();
    threeCamera = new THREE.PerspectiveCamera(30, w / h, 0.1, 1000);
    // 카메라를 더 낮게, 더 멀리서 전신이 보이도록
    threeCamera.position.set(0, 1.0, 5);
    threeCamera.lookAt(0, 0.8, 0);

    threeRenderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    threeRenderer.setSize(w, h);
    threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    threeRenderer.outputColorSpace = THREE.SRGBColorSpace;
    // 그림자 활성화
    threeRenderer.shadowMap.enabled = true;
    threeRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 조명
    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    threeScene.add(ambient);

    // 메인 조명 (그림자 생성)
    const directional = new THREE.DirectionalLight(0xffffff, 1.2);
    directional.position.set(2, 4, 2);
    directional.castShadow = true;
    directional.shadow.mapSize.width = 1024;
    directional.shadow.mapSize.height = 1024;
    directional.shadow.camera.near = 0.1;
    directional.shadow.camera.far = 10;
    directional.shadow.camera.left = -3;
    directional.shadow.camera.right = 3;
    directional.shadow.camera.top = 3;
    directional.shadow.camera.bottom = -3;
    directional.shadow.bias = -0.001;
    threeScene.add(directional);

    const backLight = new THREE.DirectionalLight(0xffffff, 0.4);
    backLight.position.set(-2, 1, -2);
    threeScene.add(backLight);

    // 바닥 그림자용 평면 (투명하지만 그림자만 받음) - 크기를 줄여서 벽 뚫는 문제 해결
    const shadowPlaneGeometry = new THREE.PlaneGeometry(3, 3);
    const shadowPlaneMaterial = new THREE.ShadowMaterial({
        opacity: 0.25,
        color: 0x000000,
    });
    shadowPlane = new THREE.Mesh(shadowPlaneGeometry, shadowPlaneMaterial);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -0.5;
    shadowPlane.receiveShadow = true;
    threeScene.add(shadowPlane);

    // GLB 모델 로드
    const loader = new GLTFLoader();
    loader.load(
        '/3dmodel/newjeans_lightstick_3d_model.glb',
        (gltf) => {
            lightstickModel = gltf.scene;
            lightstickModel.scale.set(2.4, 2.4, 2.4);
            lightstickModel.position.set(0, 0, 0);
            threeScene.add(lightstickModel);

            // 모델 중심으로 카메라 조정
            const box = new THREE.Box3().setFromObject(lightstickModel);
            const center = box.getCenter(new THREE.Vector3());
            threeCamera.lookAt(center);

            console.log('기본 모델 로드 완료');
        },
        undefined,
        (err) => console.error('GLB 로드 실패:', err)
    );

    // 창 크기 변경 시 캔버스 리사이즈
    window.addEventListener('resize', () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        threeCamera.aspect = w / h;
        threeCamera.updateProjectionMatrix();
        threeRenderer.setSize(w, h);
    });
}

const animateClock = new THREE.Clock();

function animateThree() {
    requestAnimationFrame(animateThree);

    try {
        const delta = animateClock.getDelta();

        // VRM 업데이트
        if (currentVrm) {
            currentVrm.update(delta);
        }

        // 애니메이션 믹서 업데이트
        if (modelMixer) {
            modelMixer.update(delta);
        }

        if (lightstickModel && modelAutoRotate) {
            modelRotation += 0.008;
            lightstickModel.rotation.y = modelRotation;
        }
        if (threeRenderer && threeScene && threeCamera) {
            threeRenderer.render(threeScene, threeCamera);
        }
    } catch (err) {
        console.error('animateThree error:', err);
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
    document.documentElement.style.setProperty('--depth', `${Math.round(clamp(p * 1.0, 700, 1400))}px`);
    document.documentElement.style.setProperty(
        '--grid',
        `${Math.round(clamp(Math.min(window.innerWidth, h) / 12, 50, 100))}px`
    );
}
updatePerspective();
window.addEventListener('resize', updatePerspective);

let lastOriginX = -1e9,
    lastOriginY = -1e9;
function updateScene(xPx, yPx) {
    const w = Math.max(1, window.innerWidth),
        h = Math.max(1, window.innerHeight);
    const originX = clamp(w / 2 + softClamp(xPx, w * 0.48), w * 0.02, w * 0.98);
    const originY = clamp(h / 2 + softClamp(yPx, h * 0.55), h * 0.03, h * 0.97);
    if (Math.abs(originX - lastOriginX) < 0.08 && Math.abs(originY - lastOriginY) < 0.08) return;
    lastOriginX = originX;
    lastOriginY = originY;
    container.style.perspectiveOrigin = `${originX.toFixed(1)}px ${originY.toFixed(1)}px`;
}

// --- Render loop (always 60fps) ---
let targetX = 0,
    targetY = 0,
    displayX = 0,
    displayY = 0;
let rafId = 0,
    lastMs = 0;

function renderTick(now) {
    if (!isTracking) return;
    if (!lastMs) lastMs = now;
    const dt = now - lastMs;
    lastMs = now;

    // 시간 기반 부드러운 보간 (dt에 비례)
    const smoothFactor = 1 - Math.exp(-dt / 25); // 25ms 기준 스무딩

    displayX += (targetX - displayX) * smoothFactor;
    displayY += (targetY - displayY) * smoothFactor;

    updateScene(displayX, displayY);
    rafId = requestAnimationFrame(renderTick);
}
function startRender() {
    stopRender();
    lastMs = 0;
    displayX = targetX;
    displayY = targetY;
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
const headSmoothAlpha = 0.8; // 빠른 반응
const deadzoneMm = 1.2; // 미세 떨림 무시

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
        xMm: clamp(xMm, -200, 200),
        yMm: clamp(yMm, -150, 150),
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
const detectIntervalMs = 33; // ~30fps 감지

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
        targetX = targetY = displayX = displayY = 0;

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
    displayX = displayY = targetX = targetY = 0;
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
    // 타겟, 디스플레이 리셋
    targetX = targetY = 0;
    displayX = displayY = 0;
});

toggleVideoCheckbox.addEventListener('change', () => {
    videoContainer.style.display = toggleVideoCheckbox.checked ? 'block' : 'none';
});

modelRotateCheckbox.addEventListener('change', () => {
    modelAutoRotate = modelRotateCheckbox.checked;
    // 자동 회전 끄면 기본 각도(0도)로 리셋
    if (!modelAutoRotate && lightstickModel) {
        modelRotation = 0;
        modelAngle = 0;
        modelAngleSlider.value = 0;
        modelAngleValue.textContent = '0°';
        lightstickModel.rotation.y = 0;
    }
});

// 모델 조절 슬라이더
const modelYSlider = document.getElementById('model-y-slider');
const modelYValue = document.getElementById('model-y-value');
const modelAngleSlider = document.getElementById('model-angle-slider');
const modelAngleValue = document.getElementById('model-angle-value');
const modelScaleSlider = document.getElementById('model-scale-slider');
const modelScaleValue = document.getElementById('model-scale-value');

modelYSlider.addEventListener('input', () => {
    modelYOffset = parseFloat(modelYSlider.value);
    modelYValue.textContent = modelYOffset.toFixed(1);
    updateModelTransform();
});

modelAngleSlider.addEventListener('input', () => {
    let rawAngle = parseFloat(modelAngleSlider.value);

    // 스냅 각도들 (0, 45, 90, 135, 180, 225, 270, 315, 360)
    const snapAngles = [0, 45, 90, 135, 180, 225, 270, 315, 360];
    const snapThreshold = 8; // 8도 이내면 스냅

    for (const snapAngle of snapAngles) {
        if (Math.abs(rawAngle - snapAngle) <= snapThreshold) {
            rawAngle = snapAngle;
            modelAngleSlider.value = snapAngle;
            break;
        }
    }

    modelAngle = rawAngle;
    modelAngleValue.textContent = `${modelAngle}°`;
    if (lightstickModel && !modelAutoRotate) {
        lightstickModel.rotation.y = (modelAngle * Math.PI) / 180;
        modelRotation = lightstickModel.rotation.y;
    }
});

modelScaleSlider.addEventListener('input', () => {
    modelScaleFactor = parseFloat(modelScaleSlider.value);
    modelScaleValue.textContent = `${modelScaleFactor.toFixed(1)}x`;
    updateModelTransform();
});

function updateModelTransform() {
    if (!lightstickModel) return;
    lightstickModel.position.y = baseModelY + modelYOffset;
    lightstickModel.scale.set(
        baseModelScale.x * modelScaleFactor,
        baseModelScale.y * modelScaleFactor,
        baseModelScale.z * modelScaleFactor
    );
    // 그림자 평면도 모델 발 아래로 이동
    if (shadowPlane) {
        shadowPlane.position.y = baseModelY + modelYOffset - 0.01;
    }
    // 카메라가 모델 Y 위치를 따라가도록 (모델이 잘리지 않게)
    if (threeCamera) {
        const targetY = 1.0 + modelYOffset * 0.5;
        threeCamera.position.y = targetY;
        threeCamera.lookAt(0, 0.8 + modelYOffset * 0.5, 0);
    }
}

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

// --- 설정 패널 ---
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const settingsApplyBtn = document.getElementById('settings-apply-btn');
const settingsResetBtn = document.getElementById('settings-reset-btn');
const settingsCloseBtn = document.getElementById('settings-close-btn');
const modelTypeSelect = document.getElementById('model-type-select');
const modelFileInput = document.getElementById('model-file-input');
const modelFileName = document.getElementById('model-file-name');
const motionSection = document.getElementById('motion-section');
const motionFileInput = document.getElementById('motion-file-input');
const motionFileName = document.getElementById('motion-file-name');
const bgTypeTabs = document.querySelectorAll('.bg-type-tab');
const bgImageInput = document.getElementById('bg-image-input');
const bgVideoInput = document.getElementById('bg-video-input');
const bgYoutubeInput = document.getElementById('bg-youtube-input');
const viewportBgColor = document.getElementById('viewport-bg-color');
const viewportBgValue = document.getElementById('viewport-bg-value');
const presetBtns = document.querySelectorAll('.preset-btn');

// 뷰포트 배경색 변경
viewportBgColor.addEventListener('input', () => {
    const color = viewportBgColor.value;
    viewportBgValue.textContent = color;
    document.getElementById('container').style.background = color;
    document.body.style.background = color;
});

// 현재 설정 상태
let currentSettings = {
    modelType: 'object',
    modelFile: null,
    motionFile: null,
    bgType: 'none',
    bgFile: null,
    bgYoutubeUrl: '',
    preset: 'none',
};

// 배경 요소
let bgElement = null;

// --- 이펙트 시스템 ---
const effectCanvas = document.getElementById('effect-canvas');
const effectCtx = effectCanvas.getContext('2d');
let particles = [];
let effectAnimationId = null;
let currentEffect = 'none';
let laserAngle = 0;

// 캔버스 크기 설정
function resizeEffectCanvas() {
    effectCanvas.width = window.innerWidth;
    effectCanvas.height = window.innerHeight;
}
resizeEffectCanvas();
window.addEventListener('resize', resizeEffectCanvas);

// 파티클 클래스
class Particle {
    constructor(type) {
        this.type = type;
        this.reset();
    }

    reset() {
        this.x = Math.random() * effectCanvas.width;
        this.y = Math.random() * effectCanvas.height;
        this.size = Math.random() * 4 + 2;
        this.speedX = (Math.random() - 0.5) * 2;
        this.speedY = Math.random() * 2 + 0.5;
        this.opacity = Math.random() * 0.8 + 0.2;
        this.life = 1;
        this.decay = Math.random() * 0.005 + 0.002;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.1;

        // 타입별 설정
        if (this.type === 'firefly') {
            this.size = Math.random() * 6 + 3;
            this.speedX = (Math.random() - 0.5) * 1;
            this.speedY = (Math.random() - 0.5) * 1;
            this.hue = Math.random() * 60 + 40; // 노랑~주황
            this.pulse = Math.random() * Math.PI * 2;
        } else if (this.type === 'snow') {
            this.y = -20;
            this.size = Math.random() * 5 + 2;
            this.speedY = Math.random() * 2 + 1;
            this.speedX = (Math.random() - 0.5) * 1;
            this.wobble = Math.random() * Math.PI * 2;
        } else if (this.type === 'heart') {
            this.y = effectCanvas.height + 20;
            this.speedY = -(Math.random() * 2 + 1);
            this.size = Math.random() * 15 + 10;
            this.hue = Math.random() * 30 + 330; // 핑크~빨강
        } else if (this.type === 'star') {
            this.twinkle = Math.random() * Math.PI * 2;
            this.size = Math.random() * 3 + 1;
            this.speedX = 0;
            this.speedY = 0;
        } else if (this.type === 'club') {
            this.size = Math.random() * 3 + 1;
            this.hue = Math.random() * 360;
            this.speedY = -(Math.random() * 3 + 1);
            this.y = effectCanvas.height;
        }
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.rotation += this.rotationSpeed;

        if (this.type === 'firefly') {
            this.pulse += 0.05;
            this.opacity = 0.3 + Math.sin(this.pulse) * 0.5;
            // 부드러운 방향 전환
            this.speedX += (Math.random() - 0.5) * 0.1;
            this.speedY += (Math.random() - 0.5) * 0.1;
            this.speedX = Math.max(-1, Math.min(1, this.speedX));
            this.speedY = Math.max(-1, Math.min(1, this.speedY));
        } else if (this.type === 'snow') {
            this.wobble += 0.02;
            this.x += Math.sin(this.wobble) * 0.5;
        } else if (this.type === 'star') {
            this.twinkle += 0.03;
            this.opacity = 0.3 + Math.sin(this.twinkle) * 0.7;
        }

        // 화면 밖으로 나가면 리셋
        if (this.type === 'snow' && this.y > effectCanvas.height + 20) {
            this.reset();
        } else if (this.type === 'heart' && this.y < -30) {
            this.reset();
        } else if (this.type === 'club' && this.y < -20) {
            this.reset();
        } else if (
            this.type === 'firefly' &&
            (this.x < -20 || this.x > effectCanvas.width + 20 || this.y < -20 || this.y > effectCanvas.height + 20)
        ) {
            this.reset();
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        if (this.type === 'firefly') {
            // 글로우 효과
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size * 2);
            gradient.addColorStop(0, `hsla(${this.hue}, 100%, 70%, 1)`);
            gradient.addColorStop(0.5, `hsla(${this.hue}, 100%, 50%, 0.5)`);
            gradient.addColorStop(1, `hsla(${this.hue}, 100%, 50%, 0)`);
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, this.size * 2, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'snow') {
            ctx.fillStyle = 'white';
            ctx.shadowColor = 'white';
            ctx.shadowBlur = 10;
            // 눈송이 모양
            for (let i = 0; i < 6; i++) {
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(0, -this.size);
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.rotate(Math.PI / 3);
            }
        } else if (this.type === 'heart') {
            ctx.fillStyle = `hsla(${this.hue}, 80%, 60%, 1)`;
            ctx.shadowColor = `hsla(${this.hue}, 80%, 60%, 0.8)`;
            ctx.shadowBlur = 15;
            this.drawHeart(ctx, 0, 0, this.size);
        } else if (this.type === 'star') {
            ctx.fillStyle = `rgba(255, 255, 200, ${this.opacity})`;
            ctx.shadowColor = 'rgba(255, 255, 200, 0.8)';
            ctx.shadowBlur = 10;
            this.drawStar(ctx, 0, 0, this.size, this.size * 0.5, 5);
        } else if (this.type === 'club') {
            // 미러볼 반사광
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size * 2);
            gradient.addColorStop(0, `hsla(${this.hue}, 100%, 70%, 1)`);
            gradient.addColorStop(1, `hsla(${this.hue}, 100%, 50%, 0)`);
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, this.size * 2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    drawHeart(ctx, x, y, size) {
        ctx.beginPath();
        const topY = y - size / 2;
        ctx.moveTo(x, topY + size / 4);
        ctx.bezierCurveTo(x, topY, x - size / 2, topY, x - size / 2, topY + size / 4);
        ctx.bezierCurveTo(x - size / 2, topY + size / 2, x, topY + size * 0.75, x, topY + size);
        ctx.bezierCurveTo(x, topY + size * 0.75, x + size / 2, topY + size / 2, x + size / 2, topY + size / 4);
        ctx.bezierCurveTo(x + size / 2, topY, x, topY, x, topY + size / 4);
        ctx.fill();
    }

    drawStar(ctx, cx, cy, outerR, innerR, points) {
        ctx.beginPath();
        for (let i = 0; i < points * 2; i++) {
            const r = i % 2 === 0 ? outerR : innerR;
            const angle = (Math.PI / points) * i - Math.PI / 2;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
    }
}

// 레이저 그리기 (클럽 이펙트용)
function drawLasers(ctx) {
    laserAngle += 0.02;
    const centerX = effectCanvas.width / 2;
    const centerY = 50;
    const colors = ['#ff0066', '#00ffff', '#ff00ff', '#00ff00', '#ffff00'];

    for (let i = 0; i < 5; i++) {
        const angle = laserAngle + (i * Math.PI * 2) / 5;
        const endX = centerX + Math.cos(angle) * effectCanvas.width;
        const endY = centerY + Math.sin(angle) * effectCanvas.height;

        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = colors[i % colors.length];
        ctx.shadowColor = colors[i % colors.length];
        ctx.shadowBlur = 20;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        ctx.restore();
    }
}

// 이펙트 초기화
function initEffect(type) {
    particles = [];
    currentEffect = type;

    if (type === 'none') {
        if (effectAnimationId) {
            cancelAnimationFrame(effectAnimationId);
            effectAnimationId = null;
        }
        effectCtx.clearRect(0, 0, effectCanvas.width, effectCanvas.height);
        return;
    }

    let count = 50;
    if (type === 'firefly') count = 30;
    else if (type === 'snow') count = 100;
    else if (type === 'heart') count = 25;
    else if (type === 'star') count = 80;
    else if (type === 'club') count = 60;

    for (let i = 0; i < count; i++) {
        particles.push(new Particle(type));
    }

    if (!effectAnimationId) {
        animateEffects();
    }
}

// 이펙트 애니메이션 루프
function animateEffects() {
    effectCtx.clearRect(0, 0, effectCanvas.width, effectCanvas.height);

    if (currentEffect === 'club') {
        drawLasers(effectCtx);
    }

    particles.forEach((p) => {
        p.update();
        p.draw(effectCtx);
    });

    if (currentEffect !== 'none') {
        effectAnimationId = requestAnimationFrame(animateEffects);
    }
}

// 설정 모달 열기/닫기
settingsBtn.addEventListener('click', () => {
    settingsModal.classList.add('show');
});

settingsCloseBtn.addEventListener('click', () => {
    settingsModal.classList.remove('show');
});

settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        settingsModal.classList.remove('show');
    }
});

// 모델 타입 변경 시 모션 섹션 표시/숨김
modelTypeSelect.addEventListener('change', () => {
    currentSettings.modelType = modelTypeSelect.value;
    if (modelTypeSelect.value === 'human') {
        motionSection.classList.add('show');
    } else {
        motionSection.classList.remove('show');
    }
});

// 모델 파일 선택
modelFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        currentSettings.modelFile = file;
        modelFileName.textContent = file.name;
        // 바로 적용
        loadUserModel(file);
    }
});

// 모션 파일 선택
motionFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        currentSettings.motionFile = file;
        motionFileName.textContent = file.name;
        // 바로 모션 적용
        loadMotionFile(file);
    }
});

// 모션 파일 로드 및 적용
function loadMotionFile(file) {
    if (!currentVrm && !lightstickModel) {
        alert('먼저 모델을 로드해주세요.');
        return;
    }

    // 모션 파일 저장 (모델 재로드 시 다시 적용하기 위해)
    lastMotionFile = file;

    const url = URL.createObjectURL(file);
    const ext = file.name.toLowerCase().split('.').pop();

    if (ext === 'fbx') {
        loadFBXAnimation(url, file.name);
    } else if (ext === 'glb' || ext === 'gltf') {
        loadGLBAnimation(url, file.name);
    } else if (ext === 'vrma') {
        loadVRMAAnimation(url, file.name);
    } else if (ext === 'bvh') {
        loadBVHAnimation(url, file.name);
    } else if (ext === 'vmd') {
        alert('VMD 파일은 현재 지원하지 않습니다. VRMA 또는 BVH 파일을 사용해주세요.');
        URL.revokeObjectURL(url);
    }
}

// VRMA 애니메이션 로드 (VRM 전용)
function loadVRMAAnimation(url, fileName) {
    if (!currentVrm) {
        alert('VRMA 파일은 VRM 모델에만 적용할 수 있습니다.');
        URL.revokeObjectURL(url);
        return;
    }

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser));

    loader.load(
        url,
        (gltf) => {
            try {
                console.log('VRMA gltf:', gltf);
                console.log('VRMA userData:', gltf.userData);

                const vrmAnimation = gltf.userData.vrmAnimations?.[0];

                if (!vrmAnimation) {
                    console.error('vrmAnimations not found in:', gltf.userData);
                    alert('이 VRMA 파일에서 애니메이션을 찾을 수 없습니다.');
                    URL.revokeObjectURL(url);
                    return;
                }

                console.log('vrmAnimation:', vrmAnimation);

                // 기존 애니메이션 정지
                if (modelMixer) {
                    modelMixer.stopAllAction();
                    modelMixer = null;
                }
                if (currentAnimationAction) {
                    currentAnimationAction.stop();
                    currentAnimationAction = null;
                }

                // VRM용 애니메이션 클립 생성
                const clip = createVRMAnimationClip(vrmAnimation, currentVrm);
                console.log('Created clip:', clip);
                console.log('Clip duration:', clip.duration);
                console.log('Clip tracks:', clip.tracks.length);

                // 믹서 생성 및 재생
                modelMixer = new THREE.AnimationMixer(currentVrm.scene);
                currentAnimationAction = modelMixer.clipAction(clip);
                currentAnimationAction.setLoop(THREE.LoopRepeat);
                currentAnimationAction.play();

                console.log('VRMA 모션 적용 완료:', fileName);
            } catch (err) {
                console.error('VRMA 처리 중 에러:', err);
                alert('VRMA 애니메이션 적용 중 오류가 발생했습니다: ' + err.message);
            }
            URL.revokeObjectURL(url);
        },
        (progress) => {
            console.log('VRMA 로딩...', ((progress.loaded / progress.total) * 100).toFixed(0) + '%');
        },
        (err) => {
            console.error('VRMA 로드 실패:', err);
            alert('VRMA 파일 로드에 실패했습니다.');
            URL.revokeObjectURL(url);
        }
    );
}

// BVH 애니메이션 로드
function loadBVHAnimation(url, fileName) {
    const bvhLoader = new BVHLoader();

    bvhLoader.load(
        url,
        (result) => {
            console.log('BVH 로드됨:', result);

            const clip = result.clip;

            if (!clip) {
                alert('이 BVH 파일에서 애니메이션을 찾을 수 없습니다.');
                URL.revokeObjectURL(url);
                return;
            }

            if (currentVrm) {
                // VRM 모델에 리타겟팅 적용
                applyAnimationToVRM(clip);
            } else if (lightstickModel) {
                applyAnimationToModel(clip, lightstickModel);
            }

            URL.revokeObjectURL(url);
            console.log('BVH 모션 적용 완료:', fileName);
        },
        (progress) => {
            console.log('BVH 로딩...', ((progress.loaded / progress.total) * 100).toFixed(0) + '%');
        },
        (err) => {
            console.error('BVH 로드 실패:', err);
            alert('BVH 파일 로드에 실패했습니다.');
            URL.revokeObjectURL(url);
        }
    );
}

// FBX 애니메이션 로드
function loadFBXAnimation(url, fileName) {
    const fbxLoader = new FBXLoader();

    fbxLoader.load(
        url,
        (fbx) => {
            console.log('FBX 로드됨:', fbx);
            console.log('애니메이션 수:', fbx.animations?.length);

            if (!fbx.animations || fbx.animations.length === 0) {
                alert('이 FBX 파일에는 애니메이션이 없습니다.');
                URL.revokeObjectURL(url);
                return;
            }

            // 애니메이션 클립 가져오기
            const clip = fbx.animations[0];
            console.log(
                '원본 클립 트랙:',
                clip.tracks.map((t) => t.name)
            );

            if (currentVrm) {
                // VRM 모델에 애니메이션 적용 (리타겟팅)
                applyAnimationToVRM(clip);
            } else if (lightstickModel) {
                // 일반 모델에 직접 적용
                applyAnimationToModel(clip, lightstickModel);
            }

            URL.revokeObjectURL(url);
            console.log('모션 적용 완료:', fileName);
        },
        (progress) => {
            console.log('FBX 로딩...', ((progress.loaded / progress.total) * 100).toFixed(0) + '%');
        },
        (err) => {
            console.error('FBX 로드 실패:', err);
            alert('FBX 파일 로드에 실패했습니다.');
            URL.revokeObjectURL(url);
        }
    );
}

// GLB 애니메이션 로드
function loadGLBAnimation(url, fileName) {
    const loader = new GLTFLoader();

    loader.load(
        url,
        (gltf) => {
            if (!gltf.animations || gltf.animations.length === 0) {
                alert('이 GLB 파일에는 애니메이션이 없습니다.');
                URL.revokeObjectURL(url);
                return;
            }

            const clip = gltf.animations[0];

            if (currentVrm) {
                applyAnimationToVRM(clip);
            } else if (lightstickModel) {
                applyAnimationToModel(clip, lightstickModel);
            }

            URL.revokeObjectURL(url);
            console.log('모션 적용 완료:', fileName);
        },
        undefined,
        (err) => {
            console.error('GLB 로드 실패:', err);
            URL.revokeObjectURL(url);
        }
    );
}

// VRM 모델에 애니메이션 적용 (리타겟팅)
function applyAnimationToVRM(clip) {
    if (!currentVrm) return;

    // 기존 애니메이션 정지
    if (modelMixer) {
        modelMixer.stopAllAction();
    }
    if (currentAnimationAction) {
        currentAnimationAction.stop();
    }

    // VRM의 humanoid 본 구조 가져오기
    const humanoid = currentVrm.humanoid;
    if (!humanoid) {
        console.error('VRM humanoid not found');
        applyAnimationToModel(clip, currentVrm.scene);
        return;
    }

    // 트랙 리타겟팅
    const retargetedTracks = [];

    for (const track of clip.tracks) {
        // 트랙 이름에서 본 이름 추출 (예: "mixamorigHips.quaternion")
        const trackNameParts = track.name.split('.');
        const propertyName = trackNameParts.pop(); // quaternion, position 등
        const bonePath = trackNameParts.join('.');

        // 경로에서 본 이름만 추출
        const boneNameMatch = bonePath.match(/([^/]+)$/);
        const originalBoneName = boneNameMatch ? boneNameMatch[1] : bonePath;

        // VRM 본 이름으로 매핑
        const vrmBoneName = boneMapping[originalBoneName];

        if (vrmBoneName) {
            // VRM에서 해당 본 찾기
            const vrmBone = humanoid.getNormalizedBoneNode(vrmBoneName);

            if (vrmBone) {
                // 새 트랙 이름 생성
                const newTrackName = `${vrmBone.name}.${propertyName}`;

                // 트랙 복사
                const newTrack = track.clone();
                newTrack.name = newTrackName;

                retargetedTracks.push(newTrack);
                console.log(`매핑: ${originalBoneName} -> ${vrmBoneName} (${vrmBone.name})`);
            }
        }
    }

    if (retargetedTracks.length === 0) {
        console.warn('리타겟팅된 트랙이 없습니다. 원본 애니메이션 직접 적용 시도...');
        applyAnimationToModel(clip, currentVrm.scene);
        return;
    }

    // 리타겟팅된 클립 생성
    const retargetedClip = new THREE.AnimationClip(clip.name || 'retargeted', clip.duration, retargetedTracks);

    // 믹서 생성 및 애니메이션 재생
    modelMixer = new THREE.AnimationMixer(currentVrm.scene);
    currentAnimationAction = modelMixer.clipAction(retargetedClip);
    currentAnimationAction.play();

    console.log('VRM 애니메이션 재생 시작, 트랙 수:', retargetedTracks.length);
}

// 일반 모델에 애니메이션 적용
function applyAnimationToModel(clip, model) {
    // 기존 애니메이션 정지
    if (modelMixer) {
        modelMixer.stopAllAction();
    }
    if (currentAnimationAction) {
        currentAnimationAction.stop();
    }

    modelMixer = new THREE.AnimationMixer(model);
    currentAnimationAction = modelMixer.clipAction(clip);
    currentAnimationAction.play();

    console.log('모델 애니메이션 재생 시작');
}

// 배경 타입 탭 전환
bgTypeTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
        bgTypeTabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        currentSettings.bgType = tab.dataset.type;

        // 입력 그룹 표시/숨김
        document.querySelectorAll('.bg-input-group').forEach((g) => g.classList.remove('show'));
        const targetGroup = document.getElementById(`bg-${tab.dataset.type}-group`);
        if (targetGroup) targetGroup.classList.add('show');
    });
});

// 배경 이미지 선택
bgImageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) currentSettings.bgFile = file;
});

// 배경 비디오 선택
bgVideoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) currentSettings.bgFile = file;
});

// YouTube URL 입력
bgYoutubeInput.addEventListener('input', (e) => {
    currentSettings.bgYoutubeUrl = e.target.value;
});

// 프리셋 선택
presetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
        presetBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        currentSettings.preset = btn.dataset.preset;
    });
});

// 이펙트 프리셋 적용
function applyPreset(presetName) {
    initEffect(presetName);
}

// 사용자 모델 로드
function loadUserModel(file) {
    const url = URL.createObjectURL(file);
    const isVrm = file.name.toLowerCase().endsWith('.vrm');

    const loader = new GLTFLoader();

    // VRM 플러그인 등록
    if (isVrm) {
        loader.register((parser) => new VRMLoaderPlugin(parser));
    }

    // 기존 모델 제거
    if (lightstickModel) {
        threeScene.remove(lightstickModel);
        lightstickModel = null;
    }
    if (currentVrm) {
        VRMUtils.deepDispose(currentVrm.scene);
        currentVrm = null;
    }
    modelMixer = null;

    loader.load(
        url,
        (gltf) => {
            if (isVrm && gltf.userData.vrm) {
                // VRM 모델 처리
                currentVrm = gltf.userData.vrm;
                VRMUtils.removeUnnecessaryJoints(currentVrm.scene);

                lightstickModel = currentVrm.scene;

                // 그림자 설정
                lightstickModel.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                // VRM 모델 크기 조정
                const box = new THREE.Box3().setFromObject(lightstickModel);
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const scale = 2.2 / maxDim;
                lightstickModel.scale.set(scale, scale, scale);

                // 위치 조정 (발이 바닥에 닿도록)
                const center = box.getCenter(new THREE.Vector3());
                lightstickModel.position.set(-center.x * scale, -box.min.y * scale - 0.5, -center.z * scale);

                // 기본값 저장
                baseModelScale.set(scale, scale, scale);
                baseModelY = lightstickModel.position.y;

                // 슬라이더 값 적용
                updateModelTransform();
                if (!modelAutoRotate) {
                    lightstickModel.rotation.y = (modelAngle * Math.PI) / 180;
                }

                threeScene.add(lightstickModel);

                console.log('VRM 모델 로드 완료:', file.name);

                // 이전 모션 파일이 있으면 다시 적용
                if (lastMotionFile) {
                    setTimeout(() => {
                        console.log('이전 모션 다시 적용:', lastMotionFile.name);
                        loadMotionFile(lastMotionFile);
                    }, 100);
                }
            } else {
                // 일반 GLTF/GLB 모델 처리
                lightstickModel = gltf.scene;

                // 바운딩 박스로 크기 자동 조정
                const box = new THREE.Box3().setFromObject(lightstickModel);
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const scale = 2.0 / maxDim;
                lightstickModel.scale.set(scale, scale, scale);

                // 중앙 정렬
                const center = box.getCenter(new THREE.Vector3());
                lightstickModel.position.sub(center.multiplyScalar(scale));

                // 기본값 저장
                baseModelScale.set(scale, scale, scale);
                baseModelY = lightstickModel.position.y;

                // 슬라이더 값 적용
                updateModelTransform();
                if (!modelAutoRotate) {
                    lightstickModel.rotation.y = (modelAngle * Math.PI) / 180;
                }

                threeScene.add(lightstickModel);

                // 애니메이션이 있으면 재생
                if (gltf.animations && gltf.animations.length > 0) {
                    modelMixer = new THREE.AnimationMixer(lightstickModel);
                    gltf.animations.forEach((clip) => {
                        modelMixer.clipAction(clip).play();
                    });
                }

                console.log('GLTF/GLB 모델 로드 완료:', file.name);
            }

            URL.revokeObjectURL(url);
        },
        (progress) => {
            const percent = ((progress.loaded / progress.total) * 100).toFixed(0);
            console.log(`모델 로딩 중... ${percent}%`);
        },
        (err) => {
            console.error('모델 로드 실패:', err);
            alert('모델 로드에 실패했습니다. 파일을 확인해주세요.\n\n지원 포맷: .glb, .gltf, .vrm');
            URL.revokeObjectURL(url);
        }
    );
}

// 배경 적용
function applyBackground() {
    // 기존 배경 제거
    if (bgElement) {
        bgElement.remove();
        bgElement = null;
    }

    const backWall = document.querySelector('.back-wall');
    backWall.classList.remove('no-grid'); // 그리드 복원

    if (currentSettings.bgType === 'none') {
        backWall.style.background = '';
        return;
    }

    if (currentSettings.bgType === 'image' && currentSettings.bgFile) {
        const url = URL.createObjectURL(currentSettings.bgFile);
        backWall.style.background = `url(${url}) center/cover no-repeat`;
    } else if (currentSettings.bgType === 'video' && currentSettings.bgFile) {
        const url = URL.createObjectURL(currentSettings.bgFile);
        bgElement = document.createElement('video');
        bgElement.src = url;
        bgElement.autoplay = true;
        bgElement.loop = true;
        bgElement.muted = true;
        bgElement.playsInline = true;
        bgElement.style.cssText = `
            position: absolute;
            top: 0; left: 0;
            width: 100%; height: 100%;
            object-fit: cover;
            z-index: -1;
        `;
        backWall.style.background = 'transparent';
        backWall.appendChild(bgElement);
        bgElement.play();
    } else if (currentSettings.bgType === 'youtube' && currentSettings.bgYoutubeUrl) {
        const videoId = extractYoutubeId(currentSettings.bgYoutubeUrl);
        if (videoId) {
            bgElement = document.createElement('iframe');
            bgElement.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&showinfo=0&modestbranding=1&rel=0`;
            bgElement.allow = 'autoplay';
            bgElement.frameBorder = '0';
            bgElement.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                width: 200%;
                height: 200%;
                transform: translate(-50%, -50%);
                border: none;
                pointer-events: none;
            `;
            backWall.style.background = 'transparent';
            // ::before 그리드 숨기기
            backWall.classList.add('no-grid');
            backWall.appendChild(bgElement);
        }
    }
}

// YouTube URL에서 비디오 ID 추출
function extractYoutubeId(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

// 설정 적용
settingsApplyBtn.addEventListener('click', () => {
    // 모델은 파일 선택 시 바로 로드되므로 여기서는 로드하지 않음
    // (blob URL이 이미 해제되어 있어서 다시 로드하면 오류 발생)

    // 프리셋 적용
    applyPreset(currentSettings.preset);

    // 배경 적용
    applyBackground();

    settingsModal.classList.remove('show');
});

// 설정 초기화
settingsResetBtn.addEventListener('click', () => {
    currentSettings = {
        modelType: 'object',
        modelFile: null,
        motionFile: null,
        bgType: 'none',
        bgFile: null,
        bgYoutubeUrl: '',
        preset: 'none',
    };

    // UI 초기화
    modelTypeSelect.value = 'object';
    motionSection.classList.remove('show');
    modelFileName.textContent = '기본 모델 사용 중';
    motionFileName.textContent = '모션 없음';
    modelFileInput.value = '';
    motionFileInput.value = '';
    bgImageInput.value = '';
    bgVideoInput.value = '';
    bgYoutubeInput.value = '';

    bgTypeTabs.forEach((t) => t.classList.remove('active'));
    document.querySelector('[data-type="none"]').classList.add('active');
    document.querySelectorAll('.bg-input-group').forEach((g) => g.classList.remove('show'));

    presetBtns.forEach((b) => b.classList.remove('active'));
    document.querySelector('[data-preset="none"]').classList.add('active');

    // 이펙트 제거
    applyPreset('none');

    // 배경 제거
    if (bgElement) {
        bgElement.remove();
        bgElement = null;
    }
    const backWall = document.querySelector('.back-wall');
    backWall.style.background = '';
});

stopBtn.addEventListener('click', stopCamera);
startBtn.addEventListener('click', start);
