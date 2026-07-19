export const WORLD_TRANSFORM = {
  position: [0, 0, 0],
  rotation: [Math.PI, 0, 0],
  scale: 1.54,
};

// Physics floor. A thin fixed slab. Its TOP face is set to ~-0.85 to match the
// splat's actual floor height (measured by placing a wall tile on it, which
// landed at y~=-0.9). This is what fixes the floating car.
export const GROUND_Y = -0.85; // splat floor height in world space
export const FLOOR = {
  // Covers the corridor (walls contain the player). Kept modest so tiny
  // colliders don't penetrate a hugely-larger slab.
  half: [4, 0.1, 13], // half-extents (x, y, z)
  position: [0, GROUND_Y - 0.1, 0], // top face at GROUND_Y
};

// Toy car (Rapier dynamic body).
export const CAR = {
  spawn: [0, GROUND_Y + 0.5, 0], // drop just above the floor, inside the corridor
  scale: 0.15,
  modelRotation: [0, Math.PI / 2, 0], // spin the GLB so its nose points along -Z (the "forward" axis)
  modelOffset: [0, -0.25, 0], // align visual with the ground
  // Collider is auto-measured from the car geometry (see Car.jsx), so it hugs
  // the visible car. Mass is pinned here so the tiny collider still drives well.
  mass: 0.6,

  forwardSign: -1, // flip to +1 if the car drives backwards
  engineImpulse: 7, // throttle strength
  turnRate: 6.0, // radians/sec yaw while steering (set directly, not via torque)
  maxSpeed: 4, // horizontal speed cap
  brakeFactor: 0.85, // velocity kept per frame while braking
  linearDamping: 0.6, // rolling resistance
  angularDamping: 4, // stops endless spinning after a turn

  camDistance: 2.0, // how far behind the car
  camHeight: 1.0, // how high above the car
  camLookHeight: 0.3, // look slightly above the car's origin
  camLerp: 6, // higher = snappier follow
};

// Boundary walls (invisible). Each: { half:[hx,hy,hz], position, rotation }.
// Extended from the captured segments into full floor-to-ceiling walls that
// enclose the corridor. Corridor footprint (collider space):
//   x ~= -2.15 .. 2.25   z ~= -12.2 .. 6.56   floor ~= -0.85
// Walls span y -1.0 .. 2.0 (tall enough the car can't drive over), are ~0.4m
// thick, and overlap at the corners so there are no gaps.
export const WALLS = [
  // Right side wall (runs the length in z, slight 3deg corridor yaw).
  { half: [0.2, 1.5, 9.8], position: [2.25, 0.5, -2.83], rotation: [0, 0.052, 0] },
  // Left side wall. Face aligned to a marker at x=-2.185 (inner face = center_x + half_x).
  { half: [0.2, 1.5, 9.8], position: [-2.385, 0.5, -2.83], rotation: [0, 0, 0] },
  // Far end cap (spans the width in x).
  { half: [0.2, 1.5, 3.0], position: [0.05, 0.5, -12.21], rotation: [0, -1.518, 0] },
  // Near end cap.
  { half: [0.2, 1.5, 3.0], position: [0.05, 0.5, 6.56], rotation: [0, -1.518, 0] },
];

// Keep the chase camera inside the corridor (slightly inset from the walls) so
// it never clips through a wall or shows outside the map.
export const CAM_BOUNDS = {
  min: [-2.0, GROUND_Y + 0.3, -12.0],
  max: [2.05, 3.5, 6.4], // raised so the camera can follow the character up onto the high platforms
};

// Player character (Rapier dynamic body, capsule collider). Mouse-sized.
export const CHARACTER = {
  spawn: [0, GROUND_Y + 0.1, 0],
  height: 0.1, // VISUAL size of the character (does not change the collider below).
  colliderScale: 0.7, // collider size relative to the mesh (smaller = tighter physics body)
  groundOffset: 0, // lift the model above the floor (visual only); 0 = feet flush
  moveSpeed: 0.9, // units/sec
  turnLerp: 7, // how fast it rotates to face movement
  modelYawOffset: 0, // radians — flip by Math.PI if it faces backwards
  walkIndex: 0,
  idleIndex: 3,
  climbIndex: 1, // "jump" clip, used as the ladder-climb animation
  // Ladder climbing:
  climbSpeed: 0.6, // units/sec up/down the ladder
  ladderGrabRange: 0.3, // horizontal distance to grab a ladder
  // Chase camera: sits 45° up-and-behind, looking down at the head. Kept close.
  camDistance: 0.5, // distance from the head along the 45° line (smaller = closer)
  camAngle: (25 * Math.PI) / 180, // 25° above horizontal
  camLookHeight: 0.1, // aim at the head
  camLerp: 6,
};

// Guided route the character auto-walks along. Two keys drive it:
//   press "1" (LEVEL) for the next SAME-LEVEL step,
//   press "2" (HEIGHT) for the next step that CHANGES height.
// Each press advances one waypoint (only if it matches that key's type). Height
// steps auto-handle ramps AND ladders/ropes (no WASD needed). WASD cancels to
// manual control; press a route key again to resume.
// Waypoint: { pos:[x,y,z], mode:'walk'|'climb' }.
//   walk  = walk there (follows floor/ramps, so it can also gain height on a ramp).
//   climb = grab the nearest ladder/rope and climb up to pos.y.
export const ROUTE = [
  { pos: [2, -0.85, 0.7], mode: 'walk' }, //   floor start        (LEVEL)
  { pos: [1.9, -0.18, 2.1], mode: 'walk' }, // up the ramp         (HEIGHT)
  { pos: [1.9, -0.18, 2.9], mode: 'walk' }, // across, same level  (LEVEL)
  { pos: [1.9, 0.22, 3.2], mode: 'climb' }, // up the ladder       (HEIGHT)
];

// Placed decorative props (chairs, etc.). Each:
//   { url, position:[x,y,z], rotation:[x,y,z], scale }
// Author them with the prop placer (freecam mode) and paste the captured list.
export const PROPS = [
  { url: '/models/chair.glb', position: [-1.9, -0.85, -4.3], rotation: [0, 0, 0], scale: 0.5 },
  { url: '/models/chair.glb', position: [-1.89, -0.85, 2.02], rotation: [0, 0, 0], scale: 0.5 },
  { url: '/models/table.glb', position: [1.77, -0.85, 2.635], rotation: [0, 1.536, 0], scale: 1.5 },
  { url: '/models/chair2.glb', position: [1.4, -0.89, 2.5], rotation: [0, 1.571, 0], scale: 1 },
  { url: '/models/chest.glb', position: [1.997, -0.85, 2.677], rotation: [0, -1.571, 0], scale: 0.45 },
  { url: '/models/bookshelf.glb', position: [1.887, -0.85, 4.566], rotation: [0, -1.571, 0], scale: 2.2 },
  { url: '/models/books.glb', position: [1.898, -0.19, 3.236], rotation: [0, 0, 0], scale: 0.45 },
  { url: '/models/plank.glb', position: [1.8, -0.48, 2.5], rotation: [0.873, -2.094, 0.785], scale: 0.4 },
  { url: '/models/plank.glb', position: [2, -0.55, 1.5], rotation: [-0.611, 0, 0], scale: 1.3 },
  { url: '/models/ladder.glb', position: [1.869, -0.25, 3.04], rotation: [0, 3.142, 0], scale: 0.45 },
  { url: '/models/ladder.glb', position: [1.942, 0.15, 3.286], rotation: [0.524, -3.142, 0], scale: 0.3 },
  { url: '/models/plank.glb', position: [1.899, 2.15, 5.848], rotation: [0, -1.571, 0], scale: 1.3 },
  { url: '/models/plank.glb', position: [0.699, 2.15, 5.848], rotation: [0, -1.571, 0], scale: 1.3 },
  { url: '/models/plank.glb', position: [-0.601, 2.15, 5.848], rotation: [0, -1.571, 0], scale: 1.3 },
  { url: '/models/plank.glb', position: [-1.701, 2.15, 5.848], rotation: [0, -1.571, 0], scale: 1.3 },
  { url: '/models/books.glb', position: [1.978, 0.39, 5.428], rotation: [0, -3.142, 0], scale: 0.5 },
  { url: '/models/plank.glb', position: [1.964, 0.59, 5.121], rotation: [-0.785, -3.142, 0], scale: 0.7 },
  { url: '/models/rope.glb', position: [1.897, 0.65, 5.766], rotation: [0, 0, 0], scale: 1.6 },
];
