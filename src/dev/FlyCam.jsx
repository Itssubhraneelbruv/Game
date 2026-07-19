import { useThree, useFrame } from '@react-three/fiber';
import { useKeyboardControls } from '@react-three/drei';
import { Vector3 } from 'three';

// Fly the camera with WASD (+ Q/E up-down, Shift to boost) while OrbitControls
// still handles mouse-look. We translate the camera AND the orbit target by the
// same delta so the orbit pivot travels with you and click-to-place still works.
const _fwd = new Vector3();
const _right = new Vector3();
const _up = new Vector3(0, 1, 0);
const _delta = new Vector3();

export default function FlyCam({ speed = 8 }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  const [, getKeys] = useKeyboardControls();

  useFrame((_, dt) => {
    const { forward, back, left, right, up, down, boost } = getKeys();
    const f = (forward ? 1 : 0) - (back ? 1 : 0);
    const r = (right ? 1 : 0) - (left ? 1 : 0);
    const u = (up ? 1 : 0) - (down ? 1 : 0);
    if (!f && !r && !u) return;

    camera.getWorldDirection(_fwd);
    _fwd.y = 0; // fly along the ground plane, not into the floor
    if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1);
    _fwd.normalize();
    _right.crossVectors(_fwd, _up).normalize();

    const s = speed * (boost ? 3 : 1) * dt;
    _delta
      .set(0, 0, 0)
      .addScaledVector(_fwd, f * s)
      .addScaledVector(_right, r * s)
      .addScaledVector(_up, u * s);

    camera.position.add(_delta);
    if (controls?.target) controls.target.add(_delta);
  });

  return null;
}
