# 3DViewWeb - Face Tracking 3D Room

얼굴을 인식해서 시점을 움직이면 평면 화면이 3D 창문처럼 보이는 패럴랙스 데모.

## Features

### Core
- MediaPipe 실시간 얼굴 인식
- 머리 위치에 따른 시점 변화 (패럴랙스 효과)
- CSS 3D 방 구현

### 3D Model
- VRM 모델 지원 (애니메이션 캐릭터)
- GLB/GLTF 모델 지원
- 모델 위치, 회전, 크기 조절

### Animation
- VRMA 애니메이션 지원
- BVH 모션 캡처 지원
- FBX 애니메이션 지원

### Customization
- 커스텀 3D 모델 업로드
- 커스텀 모션 업로드
- 배경 설정 (이미지, 비디오, YouTube)
- 뷰포트 배경색 변경
- 공간 이펙트 (클럽, 반딧불, 눈, 하트, 별)

## Tech Stack

- [Vite](https://vitejs.dev/) - Build tool
- [MediaPipe Tasks Vision](https://developers.google.com/mediapipe/solutions/vision/face_landmarker) - Face detection
- [Three.js](https://threejs.org/) - 3D rendering
- [@pixiv/three-vrm](https://github.com/pixiv/three-vrm) - VRM model support

## Getting Started

```bash
npm install
npm run dev
```

## Usage

1. "시작하기" 버튼 클릭
2. 카메라 권한 허용
3. 얼굴을 좌우/상하로 움직여서 3D 효과 확인
4. "기준점 설정"으로 현재 위치를 기준점으로 설정
5. "설정" 버튼으로 커스터마이징

## Supported File Formats

| Type       | Formats                         |
| ---------- | ------------------------------- |
| 3D Model   | \`.vrm\`, \`.glb\`, \`.gltf\`         |
| Animation  | \`.vrma\`, \`.bvh\`, \`.fbx\`, \`.glb\` |
| Background | 이미지, 비디오, YouTube         |

## Notes

- 카메라는 HTTPS 또는 localhost에서만 작동
- Chrome, Edge 등 Chromium 기반 브라우저 권장

## Credits

- **NewJeans Lightstick 3D Model** by [david](https://sketchfab.com/davideapsketch) on [Sketchfab](https://sketchfab.com/3d-models/newjeans-lightstick-3d-model-29df76a434054fca864c040e30c607ef)
  - Licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

## License

MIT
