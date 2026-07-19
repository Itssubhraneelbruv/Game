import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { FLOOR, WALLS } from '../config';

// Fixed collision geometry. The splat is visual-only and can never be a
// collider, so the car actually drives on / bumps into these invisible boxes.
// Turn on Physics `debug` to see them and line them up with the corridor.
export default function Boundaries() {
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={FLOOR.half} position={FLOOR.position} />
      {WALLS.map((w, i) => (
        <CuboidCollider
          key={i}
          args={w.half}
          position={w.position}
          rotation={w.rotation ?? [0, 0, 0]}
        />
      ))}
    </RigidBody>
  );
}
