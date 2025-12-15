# 3DViewWeb - Face Tracking 3D Room

A face-tracking parallax 3D room demo. Track your face with the camera and move your viewpoint to make the flat screen look like a 3D window.

## Features

### 🎯 Core
- Real-time face tracking using MediaPipe (468 landmark points)
- Head position mapped to perspective origin for parallax effect
- Smooth 60fps animation with velocity prediction
- CSS 3D room with colorful gradient walls

### 🎭 3D Model
- Three.js 3D model rendering
- **VRM model support** (anime/VTuber characters)
- GLB/GLTF model support
- Model controls: Y position, rotation angle (with 45° snapping), scale
- Auto-rotation toggle
- Model shadow with dynamic shadow plane

### 💃 Animation
- **VRMA animation support** (VRM native animation)
- **BVH motion capture support**
- **FBX animation support** with bone retargeting
- Animation auto-reapply on model reload

### 🎨 Customization (Settings Panel)
- **Custom 3D model upload** (.vrm, .glb, .gltf)
- **Custom motion/animation upload** (.vrma, .bvh, .fbx, .glb)
- **Background options**:
  - Image
  - Video
  - YouTube (embedded in back wall)
- **Viewport background color** picker
- **Space effects**:
  - 🪩 Club (laser + mirror ball)
  - ✨ Firefly (floating lights)
  - ❄️ Snow
  - 💖 Hearts
  - ⭐ Stars

## Tech Stack

- [Vite](https://vitejs.dev/) - Build tool
- [MediaPipe Tasks Vision](https://developers.google.com/mediapipe/solutions/vision/face_landmarker) - Face detection
- [Three.js](https://threejs.org/) - 3D rendering
- [@pixiv/three-vrm](https://github.com/pixiv/three-vrm) - VRM model support
- [@pixiv/three-vrm-animation](https://github.com/pixiv/three-vrm) - VRM animation support

## Getting Started

```bash
npm install
npm run dev
```

Open the URL that Vite prints (usually `http://localhost:5173`).

## Usage

1. Click the **"시작하기"** button
2. Allow camera permission
3. Move your face left/right/up/down to see the 3D effect
4. Click **"기준점 설정"** to set current position as the baseline
5. Click **"⚙️ 설정"** to open settings panel for customization

### Settings Panel
- **3D 모델**: Upload custom VRM/GLB model, adjust position/rotation/scale
- **모션**: Upload animation files for VRM characters
- **배경**: Set background image, video, or YouTube
- **뷰포트 배경**: Change viewport background color
- **공간 이펙트**: Add particle effects

## Notes

- Camera access only works on HTTPS or localhost
- Chromium-based browsers recommended (Chrome, Edge, etc.) for best performance
- VRM models work best with VRMA animation files
- BVH/FBX animations are auto-retargeted to VRM bone structure

## Supported File Formats

| Type | Formats |
|------|---------|
| 3D Model | `.vrm`, `.glb`, `.gltf` |
| Animation | `.vrma`, `.bvh`, `.fbx`, `.glb` |
| Background Image | All image formats |
| Background Video | All video formats |

## Credits

- **NewJeans Lightstick 3D Model** by [david](https://sketchfab.com/davideapsketch) on [Sketchfab](https://sketchfab.com/3d-models/newjeans-lightstick-3d-model-29df76a434054fca864c040e30c607ef)
  - Licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

## License

MIT
