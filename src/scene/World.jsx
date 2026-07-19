import { useEffect, useMemo, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { SplatMesh, SparkRenderer } from '@sparkjsdev/spark';
import { WORLD_TRANSFORM } from '../config';

export default function World({ transform = WORLD_TRANSFORM }) {
  const gl = useThree((s) => s.gl);
  const [splat, setSplat] = useState(null);

  // The SparkRenderer is what actually draws every SplatGenerator in the
  // scene. It must live in the scene graph; without it splats never render.
  const spark = useMemo(() => new SparkRenderer({ renderer: gl }), [gl]);

  useEffect(() => {
    // StrictMode double-invokes effects in dev (mount->cleanup->mount). Guard
    // the async so a disposed mesh from the first pass can't clobber the live
    // one, which would blank out the splat.
    let alive = true;
    const mesh = new SplatMesh({ url: '/world.spz' });
    mesh.initialized
      .then(() => {
        if (alive) setSplat(mesh);
        else mesh.dispose?.();
      })
      .catch((e) => console.error('splat failed', e));
    return () => {
      alive = false;
      // If still loading, the .then above disposes it once it resolves.
      if (mesh.isInitialized) mesh.dispose?.();
    };
  }, []);

  return (
    <>
      <primitive object={spark} />
      {splat && (
        <group
          position={transform.position}
          rotation={transform.rotation}
          scale={transform.scale}
        >
          <primitive object={splat} />
        </group>
      )}
    </>
  );
}
