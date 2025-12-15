# AR Web - Face Tracking 3D Room

얼굴 인식 기반 패럴랙스 3D 방 데모. 카메라로 얼굴을 추적해서 시점을 움직이면 평면 화면이 3D 창문처럼 보입니다.

## 기능

-   📷 **MediaPipe FaceLandmarker** - 실시간 얼굴 랜드마크 추적 (468개 포인트)
-   🎮 **패럴랙스 효과** - 머리 위치에 따라 원근감 변화
-   🌟 **Three.js 3D 모델** - 뉴진스 응원봉 GLB 모델 렌더링
-   🎨 **CSS 3D Room** - 각 벽면 다른 색상 (초록/파랑/빨강/노랑/흰색)
-   ⚡ **60fps 부드러운 애니메이션** - 속도 기반 예측 보간

## 스택

-   [Vite](https://vitejs.dev/) - 빌드 도구
-   [MediaPipe Tasks Vision](https://developers.google.com/mediapipe/solutions/vision/face_landmarker) - 얼굴 인식
-   [Three.js](https://threejs.org/) - 3D 렌더링
-   CSS 3D Transforms - 방 효과

## 실행

```bash
npm install
npm run dev
```

Vite가 출력하는 URL (보통 `http://localhost:5173`)을 열어주세요.

## 사용법

1. **"시작하기"** 버튼 클릭
2. 카메라 권한 허용
3. 얼굴을 좌우/위아래로 움직여서 3D 효과 확인
4. **"정면 설정"** 버튼으로 현재 위치를 기준점으로 설정

## 참고

-   카메라 접근은 HTTPS 또는 localhost에서만 작동합니다
-   움직임이 반대로 느껴지면 `src/main.js`의 `parallaxScaleX` / `parallaxScaleY` 값을 조정하세요

## 크레딧

- **NewJeans Lightstick 3D Model** by [sujinee_0](https://sketchfab.com/sujinee_0) on [Sketchfab](https://sketchfab.com/3d-models/newjeans-lightstick-3d-model-29df76a434054fca864c040e30c607ef)
  - Licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

## 라이선스

MIT
