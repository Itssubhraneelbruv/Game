import { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useKeyboardControls } from '@react-three/drei';
import { RigidBody, ConvexHullCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { CAR, GROUND_Y, CAM_BOUNDS } from '../config';

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

// Scratch objects reused every frame (avoid per-frame allocation).
const _quat = new THREE.Quaternion();
const _forward = new THREE.Vector3();
const _impulse = new THREE.Vector3();
const _carPos = new THREE.Vector3();
const _camGoal = new THREE.Vector3();

// Soft radial blob used as a contact shadow (splats can't receive real ones).
function makeBlobTexture() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

export default function Car({ active = true }) {
  const body = useRef(null);
  const shadow = useRef(null);
  const { scene } = useGLTF('/models/car.glb');
  const [, getKeys] = useKeyboardControls();
  const camera = useThree((s) => s.camera);
  const blobTexture = useMemo(makeBlobTexture, []);

  // Convex hull hugging the actual car geometry (scale + rotation + offset baked
  // in). Dynamic bodies can't use trimesh reliably, so a hull is the tight-fit
  // equivalent of what the props use. We collect every mesh vertex in the body's
  // local frame and let Rapier build the hull.
  const hullPoints = useMemo(() => {
    const obj = scene.clone();
    obj.scale.setScalar(CAR.scale);
    obj.rotation.set(...CAR.modelRotation);
    obj.position.set(...CAR.modelOffset);
    obj.updateWorldMatrix(true, true);
    const pts = [];
    const v = new THREE.Vector3();
    obj.traverse((child) => {
      if (child.isMesh && child.geometry?.attributes?.position) {
        const pos = child.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(child.matrixWorld);
          pts.push(v.x, v.y, v.z);
        }
      }
    });
    return new Float32Array(pts);
  }, [scene]);

  // Respawn at spawn point, upright and stopped.
  const resetCar = useCallback(() => {
    const rb = body.current;
    if (!rb) return;
    rb.setTranslation({ x: CAR.spawn[0], y: CAR.spawn[1], z: CAR.spawn[2] }, true);
    rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
    rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
    rb.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'KeyR') resetCar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [resetCar]);

  useFrame((_, dtRaw) => {
    const rb = body.current;
    if (!rb) return;

    // Keep the contact shadow under the car at floor level (no car rotation).
    const t = rb.translation();
    if (shadow.current) shadow.current.position.set(t.x, GROUND_Y + 0.02, t.z);

    // Fell out of the world -> auto-respawn.
    if (t.y < GROUND_Y - 5) {
      resetCar();
      return;
    }

    // In authoring mode the car is idle so WASD flies the camera instead.
    if (!active) return;
    const dt = Math.min(dtRaw, 0.05); // clamp after tab-out / stalls
    const { forward, back, left, right, brake } = getKeys();

    // Car heading from its current rotation.
    const r = rb.rotation();
    _quat.set(r.x, r.y, r.z, r.w);
    _forward.set(0, 0, CAR.forwardSign).applyQuaternion(_quat).setY(0).normalize();

    // Throttle -> impulse along heading.
    const throttle = (forward ? 1 : 0) - (back ? 1 : 0);
    if (throttle !== 0) {
      _impulse.copy(_forward).multiplyScalar(throttle * CAR.engineImpulse * dt);
      rb.applyImpulse(_impulse, true);
    }

    // Steering: set yaw velocity directly so the turn rate is predictable
    // regardless of the (tiny) collider's rotational inertia. Setting it every
    // frame (including 0) also stops any spin picked up from wall bumps.
    const steer = (left ? 1 : 0) - (right ? 1 : 0);
    rb.setAngvel({ x: 0, y: steer * CAR.turnRate, z: 0 }, true);

    // Brake + top-speed cap on the horizontal plane.
    const v = rb.linvel();
    if (brake) {
      rb.setLinvel({ x: v.x * CAR.brakeFactor, y: v.y, z: v.z * CAR.brakeFactor }, true);
    }
    const speed = Math.hypot(v.x, v.z);
    if (speed > CAR.maxSpeed) {
      const s = CAR.maxSpeed / speed;
      rb.setLinvel({ x: v.x * s, y: v.y, z: v.z * s }, true);
    }

    // Chase camera: sit behind + above the car and look at it.
    _carPos.set(t.x, t.y, t.z);
    _camGoal.copy(_forward).multiplyScalar(-CAR.camDistance).add(_carPos);
    _camGoal.y = _carPos.y + CAR.camHeight;
    camera.position.lerp(_camGoal, 1 - Math.exp(-CAR.camLerp * dt));
    // Keep the camera inside the corridor so it can't pass through walls.
    camera.position.set(
      clamp(camera.position.x, CAM_BOUNDS.min[0], CAM_BOUNDS.max[0]),
      clamp(camera.position.y, CAM_BOUNDS.min[1], CAM_BOUNDS.max[1]),
      clamp(camera.position.z, CAM_BOUNDS.min[2], CAM_BOUNDS.max[2])
    );
    camera.lookAt(_carPos.x, _carPos.y + CAR.camLookHeight, _carPos.z);
  });

  return (
    <>
      <RigidBody
        ref={body}
        colliders={false}
        position={CAR.spawn}
        enabledRotations={[false, true, false]} // lock pitch/roll: no flipping
        linearDamping={CAR.linearDamping}
        angularDamping={CAR.angularDamping}
        ccd // continuous collision detection: don't tunnel through walls
        canSleep={false}
      >
        <primitive
          object={scene}
          scale={CAR.scale}
          rotation={CAR.modelRotation}
          position={CAR.modelOffset}
        />
        <ConvexHullCollider args={[hullPoints]} mass={CAR.mass} />
      </RigidBody>

      {/* Contact/blob shadow — tracks the car at floor level. */}
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <circleGeometry args={[1, 32]} />
        <meshBasicMaterial map={blobTexture} transparent depthWrite={false} />
      </mesh>
    </>
  );
}

useGLTF.preload('/models/car.glb');
