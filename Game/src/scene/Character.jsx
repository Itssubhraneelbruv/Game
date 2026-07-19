import { useEffect, useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations, useKeyboardControls } from '@react-three/drei';
import { RigidBody, CapsuleCollider, useRapier } from '@react-three/rapier';
import * as THREE from 'three';
import { CHARACTER, GROUND_Y, CAM_BOUNDS, PROPS, ROUTE } from '../config';

// Climbables (ladders + ropes) derived from placed props. Both GLBs are ~1.0
// unit tall at scale 1 with origin at the base. We compute the base AND top
// world points (applying the prop's rotation) so the climb follows the ladder's
// actual lean instead of always going straight up.
const CLIMB_NATURAL_H = 1.0;
const LADDERS = PROPS.filter((p) => /ladder|rope/i.test(p.url)).map((p) => {
  const s = p.scale ?? 1;
  const base = new THREE.Vector3(p.position[0], p.position[1], p.position[2]);
  const up = new THREE.Vector3(0, CLIMB_NATURAL_H * s, 0).applyEuler(
    new THREE.Euler(...(p.rotation ?? [0, 0, 0]))
  );
  const top = base.clone().add(up);
  return { base: [base.x, base.y, base.z], top: [top.x, top.y, top.z] };
});

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
// Shortest-path angular lerp.
function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
function nearestLadder(x, z) {
  let best = null;
  let bestD = Infinity;
  for (const L of LADDERS) {
    const d = Math.hypot(x - L.base[0], z - L.base[2]);
    if (d < bestD) {
      bestD = d;
      best = L;
    }
  }
  return best;
}

const _camDir = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _move = new THREE.Vector3();
const _camGoal = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export default function Character({ active = true }) {
  const body = useRef(null);
  const visual = useRef(null); // useAnimations root
  const facing = useRef(null); // rotated to movement direction
  const heading = useRef(0); // world facing angle (0 = +Z); start facing up the corridor
  const currentClip = useRef(null);
  const climbing = useRef(null); // the ladder/rope being climbed (with locked grab x/z), or null
  const dismount = useRef(null); // post-climb walk-off { timeLeft, dx, dz }, or null

  // Guided-route state.
  const routeIdx = useRef(-1); // current target waypoint (-1 = not started)
  const arrived = useRef(true); // reached the current target? (then hold)
  const manualOverride = useRef(false); // WASD paused the route?
  const stuckTime = useRef(0); // how long auto-walk has made no progress
  const lastDist = useRef(Infinity); // last horizontal distance to the target

  const { scene, animations } = useGLTF('/character/character.glb');
  const { actions, names } = useAnimations(animations, visual);
  const [, getKeys] = useKeyboardControls();
  const camera = useThree((s) => s.camera);
  const { world, rapier } = useRapier();

  const dims = useMemo(() => {
    const box = new THREE.Box3();
    scene.traverse((o) => {
      if (o.isMesh && o.geometry) {
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        box.union(o.geometry.boundingBox);
      }
    });
    const size = new THREE.Vector3();
    box.getSize(size);
    const s = size.y > 0 ? CHARACTER.height / size.y : 1; // VISUAL scale
    const ch = CHARACTER.height;
    const cs = CHARACTER.colliderScale ?? 1;
    const baseR = Math.max(ch * 0.12, (Math.max(size.x, size.z) / 2) * s * 0.6);
    const radius = baseR * cs;
    const halfH = Math.max(ch * 0.08, ch / 2 - baseR) * cs;
    return { fitScale: s, footOffset: -box.min.y * s, radius, halfH };
  }, [scene, CHARACTER.height, CHARACTER.colliderScale]);

  const playClip = (name) => {
    if (!name || currentClip.current === name) return;
    const next = actions[name];
    const prev = currentClip.current && actions[currentClip.current];
    if (prev) prev.fadeOut(0.2);
    if (next) next.reset().fadeIn(0.2).play();
    currentClip.current = name;
  };

  useEffect(() => {
    playClip(names[CHARACTER.idleIndex]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, names]);

  // Route control: "1" = next same-level step, "2" = next height-change step.
  // A press advances one waypoint only if it matches that key's type.
  useEffect(() => {
    const onKey = (e) => {
      const isLevel = e.code === 'Digit1';
      const isHeight = e.code === 'Digit2';
      if (!isLevel && !isHeight) return;
      const cand = routeIdx.current + 1;
      if (cand >= ROUTE.length) return;
      const prevY = routeIdx.current >= 0 ? ROUTE[routeIdx.current].pos[1] : GROUND_Y;
      const heightMove = Math.abs(ROUTE[cand].pos[1] - prevY) >= 0.15;
      if ((isHeight && heightMove) || (isLevel && !heightMove)) {
        routeIdx.current = cand;
        arrived.current = false;
        manualOverride.current = false;
        stuckTime.current = 0;
        lastDist.current = Infinity;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useFrame((_, dtRaw) => {
    const rb = body.current;
    if (!rb) return;
    const dt = Math.min(dtRaw, 0.05);

    const keys = active ? getKeys() : {};
    const { forward, back, left, right, brake } = keys;
    const f = (forward ? 1 : 0) - (back ? 1 : 0); // W = +1
    const r = (right ? 1 : 0) - (left ? 1 : 0); // D = +1
    const t = rb.translation();

    // Floor clamp: a mesh-sized (tiny) collider can penetrate the floor slab, so
    // hard-stop the feet at GROUND_Y instead of relying on the collider alone.
    if (!climbing.current && t.y < GROUND_Y - 0.001) {
      rb.setTranslation({ x: t.x, y: GROUND_Y, z: t.z }, true);
      const lv = rb.linvel();
      if (lv.y < 0) rb.setLinvel({ x: lv.x, y: 0, z: lv.z }, true);
      t.y = GROUND_Y;
    }

    // WASD pauses the route and hands back manual control (also drops an
    // in-progress auto-climb / walk-off).
    if (active && (forward || back || left || right)) {
      if (routeIdx.current >= 0) manualOverride.current = true;
      if (climbing.current && climbing.current.targetY !== undefined) {
        rb.setBodyType(rapier.RigidBodyType.Dynamic, true);
        rb.setGravityScale(1, true);
        climbing.current = null;
      }
      dismount.current = null;
    }

    // --- Helpers (walk toward a world horizontal dir, or stand still) ---
    const walkDir = (dx, dz) => {
      const len = Math.hypot(dx, dz) || 1;
      const mx = dx / len;
      const mz = dz / len;
      // Probe ahead + a bit higher so we catch and mount even steep ramps
      // before the tiny capsule wedges into the ramp's bottom lip.
      const down = new rapier.Ray(
        { x: t.x + mx * 0.12, y: t.y + 0.2, z: t.z + mz * 0.12 },
        { x: 0, y: -1, z: 0 }
      );
      const gh = world.castRayAndGetNormal(down, 0.6, true, undefined, undefined, undefined, body.current);
      const n = gh ? gh.normal : { x: 0, y: 1, z: 0 };
      const walkable = gh && (gh.timeOfImpact ?? gh.toi) < 0.5 && n.y > 0.25;
      const v = rb.linvel();
      if (walkable) {
        const d = mx * n.x + mz * n.z;
        let vx = mx - n.x * d;
        let vy = -n.y * d;
        let vz = mz - n.z * d;
        const l = Math.hypot(vx, vy, vz) || 1;
        rb.setLinvel(
          { x: (vx / l) * CHARACTER.moveSpeed, y: (vy / l) * CHARACTER.moveSpeed, z: (vz / l) * CHARACTER.moveSpeed },
          true
        );
      } else {
        rb.setLinvel({ x: mx * CHARACTER.moveSpeed, y: v.y, z: mz * CHARACTER.moveSpeed }, true);
      }
      heading.current = lerpAngle(heading.current, Math.atan2(mx, mz), 1 - Math.exp(-CHARACTER.turnLerp * dt));
      playClip(names[CHARACTER.walkIndex]);
    };
    const standStill = () => {
      const v = rb.linvel();
      const down = new rapier.Ray({ x: t.x, y: t.y + 0.05, z: t.z }, { x: 0, y: -1, z: 0 });
      const gh = world.castRay(down, 0.4, true, undefined, undefined, undefined, body.current);
      const grounded = gh && (gh.timeOfImpact ?? gh.toi) < 0.25;
      rb.setLinvel({ x: 0, y: grounded ? 0 : v.y, z: 0 }, true);
      playClip(names[CHARACTER.idleIndex]);
    };
    // Latch onto a ladder/rope: kinematic (rides straight up, no shove-off),
    // gravity off as a safety, climbing from wherever we grabbed.
    const grabClimb = (L, extra) => {
      climbing.current = { ...L, ...extra };
      rb.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
      rb.setGravityScale(0, true);
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
    };

    if (climbing.current) {
      // ---- CLIMBING (manual: W/S; auto-path: rises to targetY) ----
      const L = climbing.current;
      const auto = L.targetY !== undefined;
      const up = auto ? 1 : f;
      // AUTO climbs to the waypoint's height (the platform top) + an overshoot to
      // clear the lip — this is usually ABOVE the ladder's own top, so it doesn't
      // stop at the side of the platform. MANUAL just goes to the ladder top.
      const ceiling = auto
        ? Math.max(L.top[1], L.targetY) + (CHARACTER.climbOvershoot ?? 0.1)
        : L.top[1];
      const newY = clamp(t.y + up * CHARACTER.climbSpeed * dt, L.base[1], ceiling);
      // Follow the ladder's actual line (base -> top) by height, so a leaning
      // ladder carries the fox forward onto the platform, not just straight up.
      // Above the ladder top the horizontal is clamped (straight up), then the
      // walk-off carries it forward onto the platform. Kinematic = no shove-off.
      const span = L.top[1] - L.base[1] || 1;
      const p = clamp((newY - L.base[1]) / span, 0, 1);
      const cx = L.base[0] + (L.top[0] - L.base[0]) * p;
      const cz = L.base[2] + (L.top[2] - L.base[2]) * p;
      rb.setNextKinematicTranslation({ x: cx, y: newY, z: cz });
      const hdx = L.top[0] - L.base[0];
      const hdz = L.top[2] - L.base[2];
      if (Math.hypot(hdx, hdz) > 0.001) heading.current = Math.atan2(hdx, hdz); // face up the lean
      playClip(names[up !== 0 ? CHARACTER.climbIndex : CHARACTER.idleIndex]);

      // Reaching the ladder top: AUTO (route) steps off by itself; MANUAL holds
      // until you keep pushing up (step off) or press Space (drop).
      const atTop = newY >= ceiling - 1e-3;
      const stepOff = !auto && atTop && f > 0;
      const done = auto ? atTop : brake || stepOff;
      if (done) {
        rb.setBodyType(rapier.RigidBodyType.Dynamic, true);
        rb.setGravityScale(1, true);
        if (auto || stepOff) {
          // Walk-off: head onto the platform for a moment, then stop. Grounded
          // (not a hop) and it halts at an edge, so it won't overshoot and fall.
          // Auto aims at the next route waypoint; manual uses the facing dir.
          let sx = Math.sin(heading.current);
          let sz = Math.cos(heading.current);
          const nextWp = auto ? ROUTE[routeIdx.current + 1] : null;
          if (nextWp) {
            const nx = nextWp.pos[0] - t.x;
            const nz = nextWp.pos[2] - t.z;
            const nl = Math.hypot(nx, nz) || 1;
            sx = nx / nl;
            sz = nz / nl;
          }
          dismount.current = { timeLeft: CHARACTER.dismountTime ?? 1.5, dx: sx, dz: sz };
        }
        const cb = L.onDone;
        climbing.current = null;
        if (cb) cb();
      }
    } else if (dismount.current) {
      // ---- WALK-OFF after a climb: go forward onto the platform, then stop.
      // Halt early if there's no ground ahead (platform edge) so we don't fall.
      const D = dismount.current;
      D.timeLeft -= dt;
      const ahead = new rapier.Ray(
        { x: t.x + D.dx * 0.1, y: t.y + 0.12, z: t.z + D.dz * 0.1 },
        { x: 0, y: -1, z: 0 }
      );
      const gh = world.castRay(ahead, 0.5, true, undefined, undefined, undefined, body.current);
      const groundAhead = gh && (gh.timeOfImpact ?? gh.toi) < 0.35;
      if (D.timeLeft <= 0 || !groundAhead) {
        dismount.current = null;
        standStill();
      } else {
        walkDir(D.dx, D.dz);
      }
    } else if (active && routeIdx.current >= 0 && !manualOverride.current) {
      // ---- GUIDED ROUTE: auto-walk/climb toward the current waypoint ----
      const wp = ROUTE[routeIdx.current];
      if (arrived.current) {
        standStill(); // reached this waypoint; wait for the next key press
      } else if (wp.mode === 'climb') {
        const L = nearestLadder(t.x, t.z);
        if (!L) {
          arrived.current = true;
        } else if (Math.hypot(L.base[0] - t.x, L.base[2] - t.z) < CHARACTER.ladderGrabRange) {
          // grab and auto-climb up the ladder, then step off toward the next wp
          grabClimb(L, { targetY: wp.pos[1], onDone: () => { arrived.current = true; } });
        } else {
          walkDir(L.base[0] - t.x, L.base[2] - t.z);
        }
      } else {
        const dx = wp.pos[0] - t.x;
        const dz = wp.pos[2] - t.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.06) {
          walkDir(dx, dz);
          // Stuck recovery: if we stop making progress (caught on a plank edge),
          // hop up to clear the lip.
          if (lastDist.current - dist < 0.0015) {
            stuckTime.current += dt;
            if (stuckTime.current > 0.3) {
              const v = rb.linvel();
              rb.setLinvel({ x: v.x, y: 1.5, z: v.z }, true);
              stuckTime.current = 0;
            }
          } else {
            stuckTime.current = 0;
          }
          lastDist.current = dist;
        } else {
          standStill();
          arrived.current = true;
        }
      }
    } else if (active) {
      // ---- MANUAL: camera-relative movement (W = into screen, D = right) ----
      camera.getWorldDirection(_camDir);
      _camDir.y = 0;
      if (_camDir.lengthSq() < 1e-6) _camDir.set(0, 0, -1);
      _camDir.normalize();
      _camRight.crossVectors(_camDir, UP).normalize();
      _move.set(0, 0, 0).addScaledVector(_camDir, f).addScaledVector(_camRight, r);
      const moving = _move.lengthSq() > 1e-4;
      if (moving) {
        _move.normalize();
        walkDir(_move.x, _move.z);
      } else {
        standStill();
        // Grab a ladder: press forward near one.
        if (f > 0) {
          const near = LADDERS.find(
            (L) => Math.hypot(t.x - L.base[0], t.z - L.base[2]) < CHARACTER.ladderGrabRange && t.y <= L.top[1] + 0.1
          );
          if (near) grabClimb(near);
        }
      }
      // Allow grabbing while walking into a ladder too.
      if (moving && f > 0) {
        const near = LADDERS.find(
          (L) => Math.hypot(t.x - L.base[0], t.z - L.base[2]) < CHARACTER.ladderGrabRange && t.y <= L.top[1] + 0.1
        );
        if (near) grabClimb(near);
      }
    } else {
      playClip(names[CHARACTER.idleIndex]); // freecam: idle
    }

    if (facing.current) facing.current.rotation.y = heading.current + CHARACTER.modelYawOffset;

    // Chase camera: 45° up-and-behind the heading, looking down at the head,
    // with collision (pull in past walls/props/platforms so it never clips).
    if (active) {
      const hx = Math.sin(heading.current);
      const hz = Math.cos(heading.current);
      const lookY = t.y + CHARACTER.camLookHeight;
      const horiz = CHARACTER.camDistance * Math.cos(CHARACTER.camAngle);
      const vert = CHARACTER.camDistance * Math.sin(CHARACTER.camAngle);
      const rx = -hx * horiz;
      const ry = vert;
      const rz = -hz * horiz;
      const rayLen = Math.hypot(rx, ry, rz) || 1; // == camDistance
      const ndx = rx / rayLen;
      const ndy = ry / rayLen;
      const ndz = rz / rayLen;

      const ray = new rapier.Ray({ x: t.x, y: lookY, z: t.z }, { x: ndx, y: ndy, z: ndz });
      const hit = world.castRay(ray, rayLen, true, undefined, undefined, undefined, body.current);
      let dist = rayLen;
      if (hit) {
        const toi = hit.timeOfImpact ?? hit.toi;
        dist = clamp(toi - 0.03, 0.1, rayLen);
      }
      _camGoal.set(t.x + ndx * dist, lookY + ndy * dist, t.z + ndz * dist);
      camera.position.lerp(_camGoal, 1 - Math.exp(-CHARACTER.camLerp * dt));
      camera.position.set(
        clamp(camera.position.x, CAM_BOUNDS.min[0], CAM_BOUNDS.max[0]),
        clamp(camera.position.y, CAM_BOUNDS.min[1], CAM_BOUNDS.max[1]),
        clamp(camera.position.z, CAM_BOUNDS.min[2], CAM_BOUNDS.max[2])
      );
      camera.lookAt(t.x, lookY, t.z);
    }
  });

  return (
    <RigidBody
      ref={body}
      colliders={false}
      position={CHARACTER.spawn}
      enabledRotations={[false, false, false]} // stays upright, no spin
      ccd
      canSleep={false}
    >
      <group ref={visual}>
        <group ref={facing}>
          {/* Scale/offset live on this wrapper — never on the shared scene. */}
          <group scale={dims.fitScale} position={[0, dims.footOffset + CHARACTER.groundOffset, 0]}>
            <primitive object={scene} />
          </group>
        </group>
      </group>
      {/* Center at halfH+radius so the capsule BOTTOM sits at the feet (y=0). */}
      <CapsuleCollider args={[dims.halfH, dims.radius]} position={[0, dims.halfH + dims.radius, 0]} />
    </RigidBody>
  );
}

useGLTF.preload('/character/character.glb');
