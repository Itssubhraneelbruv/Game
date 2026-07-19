import { useState, useEffect, useCallback, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Box, KeyboardControls } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import World from './scene/World';
import Character from './scene/Character';
import Boundaries from './scene/Boundaries';
import Props from './scene/Props';
import WorldTuner from './dev/WorldTuner';
import FlyCam from './dev/FlyCam';
import Probe from './dev/Probe';
import PropPlacer from './dev/PropPlacer';
import PropReadout from './dev/PropReadout';
import { WORLD_TRANSFORM, GROUND_Y } from './config';

// Show collider wireframes (floor/walls). Set false for the clean look.
const DEBUG = true;
const DEG = Math.PI / 180;
const PROP_URLS = ['/models/rope.glb', '/models/books.glb', '/models/plank.glb'];

const KEYMAP = [
  { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
  { name: 'back', keys: ['ArrowDown', 'KeyS'] },
  { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
  { name: 'right', keys: ['ArrowRight', 'KeyD'] },
  { name: 'brake', keys: ['Space'] },
  // Fly-cam only (freecam mode).
  { name: 'up', keys: ['KeyE'] },
  { name: 'down', keys: ['KeyQ'] },
  { name: 'boost', keys: ['ShiftLeft', 'ShiftRight'] },
];

export default function App() {
  const [transform, setTransform] = useState(WORLD_TRANSFORM);
  // Play mode by default; press C for freecam + placing props.
  const [freeCam, setFreeCam] = useState(false);

  // Prop-placement tool state.
  const [propUrl, setPropUrl] = useState(PROP_URLS[0]);
  const [propPos, setPropPos] = useState([0, GROUND_Y + 0.5, 0]);
  const [propRot, setPropRot] = useState([0, 0, 0]); // radians
  const [propScale, setPropScale] = useState(1);
  const [propBaseY, setPropBaseY] = useState(GROUND_Y);
  const [captured, setCaptured] = useState([]);

  const placeProp = useCallback((x, z) => {
    setPropPos((p) => [x, p[1], z]);
  }, []);
  const dropToFloor = () => setPropPos((p) => [p[0], p[1] - (propBaseY - GROUND_Y), p[2]]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'KeyC') {
        setFreeCam((f) => !f);
        return;
      }
      if (!freeCam) return; // prop nudging only in freecam mode

      const big = e.shiftKey;
      const mv = big ? 1.5 : 0.25;
      const rot = (big ? 15 : 5) * DEG;
      const sc = big ? 0.5 : 0.1;

      const bump = (i, d) => setPropPos((p) => p.map((v, k) => (k === i ? v + d : v)));
      const spin = (i, d) => setPropRot((r) => r.map((v, k) => (k === i ? v + d : v)));

      switch (e.code) {
        case 'KeyJ': bump(0, -mv); break;
        case 'KeyL': bump(0, +mv); break;
        case 'KeyU': bump(1, +mv); break;
        case 'KeyO': bump(1, -mv); break;
        case 'KeyI': bump(2, -mv); break;
        case 'KeyK': bump(2, +mv); break;
        case 'BracketLeft': spin(1, -rot); break; // yaw
        case 'BracketRight': spin(1, +rot); break;
        case 'Semicolon': spin(0, -rot); break; // pitch
        case 'Quote': spin(0, +rot); break;
        case 'KeyN': spin(2, -rot); break; // roll
        case 'KeyM': spin(2, +rot); break;
        case 'Comma': setPropScale((s) => Math.max(0.01, s - sc)); break;
        case 'Period': setPropScale((s) => s + sc); break;
        default: return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [freeCam]);

  return (
    <>
      <KeyboardControls map={KEYMAP}>
        <Canvas gl={{ antialias: false }} camera={{ position: [0, 3, 8], fov: 60 }}>
          <ambientLight intensity={0.8} />
          <directionalLight position={[5, 10, 5]} intensity={1} />

          <World transform={transform} />

          <Physics debug={DEBUG} gravity={[0, -9.81, 0]}>
            <Boundaries />
            <Suspense fallback={null}>
              <Props />
            </Suspense>
            <Suspense fallback={null}>
              <Character active={!freeCam} />
            </Suspense>
          </Physics>

          <Box args={[0.5, 1.7, 0.5]} position={[0, 0.85, 0]}>
            <meshBasicMaterial color="red" wireframe />
          </Box>
          <axesHelper args={[5]} />

          {freeCam && (
            <>
              <Suspense fallback={null}>
                <PropPlacer
                  url={propUrl}
                  position={propPos}
                  rotation={propRot}
                  scale={propScale}
                  onMeasure={({ minY }) => setPropBaseY(minY)}
                />
              </Suspense>
              <Probe onPlace={placeProp} />
              <FlyCam speed={8} />
              <OrbitControls makeDefault />
            </>
          )}
        </Canvas>
      </KeyboardControls>

      <WorldTuner value={transform} onChange={setTransform} />
      {freeCam && (
        <PropReadout
          urls={PROP_URLS}
          url={propUrl}
          setUrl={setPropUrl}
          pos={propPos}
          setPos={setPropPos}
          rotDeg={propRot.map((r) => r / DEG)}
          setRotAxisDeg={(i, d) => setPropRot((r) => r.map((v, k) => (k === i ? d * DEG : v)))}
          scale={propScale}
          setScale={setPropScale}
          onDropToFloor={dropToFloor}
          captured={captured}
          onCapture={() =>
            setCaptured((c) => [...c, { url: propUrl, position: propPos, rotation: propRot, scale: propScale }])
          }
          onUndo={() => setCaptured((c) => c.slice(0, -1))}
          onClear={() => setCaptured([])}
        />
      )}
    </>
  );
}

