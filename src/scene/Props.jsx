import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';
import { PROPS } from '../config';

// Collider type per prop:
//   plank -> "cuboid": a smooth box so the character walks up ramps / across
//            platforms without snagging on trimesh edges.
//   rope  -> none (visual only): it's climbed by proximity, not bumped.
//   else  -> "trimesh": hugs the real shape (walk under tables, between legs).
function colliderFor(url) {
  if (/plank/i.test(url)) return 'cuboid';
  if (/rope/i.test(url)) return false;
  return 'trimesh';
}

function Prop({ url, position, rotation = [0, 0, 0], scale = 1 }) {
  const { scene } = useGLTF(url);
  const model = useMemo(() => scene.clone(), [scene]);
  return (
    <RigidBody type="fixed" colliders={colliderFor(url)} position={position} rotation={rotation}>
      <primitive object={model} scale={scale} />
    </RigidBody>
  );
}

export default function Props() {
  return PROPS.map((p, i) => <Prop key={i} {...p} />);
}
