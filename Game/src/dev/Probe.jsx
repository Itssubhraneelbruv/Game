import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Plane, Vector3, Vector2 } from 'three';

// The splat is visual-only (no mesh to raycast), so we intersect an infinite
// ground plane at y=0 instead. A real click (not an orbit-drag) on the floor
// reports the world (x, z) there. Listens on the canvas element so clicks on
// the DOM panels are ignored.
const _plane = new Plane(new Vector3(0, 1, 0), 0);
const _hit = new Vector3();
const _ndc = new Vector2();

export default function Probe({ onPlace }) {
  const { camera, raycaster, gl } = useThree();

  useEffect(() => {
    const el = gl.domElement;
    let downX = 0;
    let downY = 0;
    let moved = false;

    const onDown = (e) => {
      downX = e.clientX;
      downY = e.clientY;
      moved = false;
    };
    const onMove = (e) => {
      if (Math.abs(e.clientX - downX) > 5 || Math.abs(e.clientY - downY) > 5) {
        moved = true; // a drag => orbiting, not a place-click
      }
    };
    const onUp = (e) => {
      if (moved) return;
      const rect = el.getBoundingClientRect();
      _ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(_ndc, camera);
      if (raycaster.ray.intersectPlane(_plane, _hit)) {
        console.log('floor hit x,z:', _hit.x.toFixed(2), _hit.z.toFixed(2));
        onPlace?.(_hit.x, _hit.z);
      }
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
    };
  }, [camera, raycaster, gl, onPlace]);

  return null;
}
