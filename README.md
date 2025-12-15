# 3DViewWeb - Face Tracking 3D Room

A face-tracking parallax 3D room demo. Track your face with the camera and move your viewpoint to make the flat screen look like a 3D window.

## Features

- **MediaPipe FaceLandmarker** - Real-time face landmark tracking (468 points)
- **Parallax Effect** - Perspective changes based on head position
- **Three.js 3D Model** - NewJeans lightstick GLB model rendering
- **CSS 3D Room** - Each wall has a different color (green/blue/red/yellow/white)
- **60fps Smooth Animation** - Velocity-based predictive interpolation

## Tech Stack

- [Vite](https://vitejs.dev/) - Build tool
- [MediaPipe Tasks Vision](https://developers.google.com/mediapipe/solutions/vision/face_landmarker) - Face detection
- [Three.js](https://threejs.org/) - 3D rendering

## Getting Started

```bash
npm install
npm run dev
```

Open the URL that Vite prints (usually `http://localhost:5173`).

## Usage

1. Click the **"Start"** button
2. Allow camera permission
3. Move your face left/right/up/down to see the 3D effect
4. Click **"Set Center"** button to set current position as the baseline

## Notes

- Camera access only works on HTTPS or localhost
- Chromium-based browsers recommended (Chrome, Edge, etc.) for best performance
- If motion feels reversed, adjust `parallaxScaleX` / `parallaxScaleY` values in `src/main.js`

## Credits

- **NewJeans Lightstick 3D Model** by [david](https://sketchfab.com/davideapsketch) on [Sketchfab](https://sketchfab.com/3d-models/newjeans-lightstick-3d-model-29df76a434054fca864c040e30c607ef)
  - Licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

## License

MIT
