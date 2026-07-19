import { useState } from 'react';

// Dev-only overlay for dialing in WORLD_TRANSFORM against the red 1.7m ruler
// box and the axesHelper at y=0. Rotation shown in degrees for sanity; the
// value handed to <World> is converted to radians. Hit "Copy config" and paste
// the result into src/config.js, then delete this overlay for the build.
const DEG = Math.PI / 180;

export default function WorldTuner({ value, onChange }) {
  const [open, setOpen] = useState(true);

  // value.rotation is radians; edit in degrees.
  const rotDeg = value.rotation.map((r) => Math.round((r / DEG) * 10) / 10);

  const setPos = (i, v) => {
    const position = [...value.position];
    position[i] = v;
    onChange({ ...value, position });
  };
  const setRotDeg = (i, deg) => {
    const rotation = [...value.rotation];
    rotation[i] = deg * DEG;
    onChange({ ...value, rotation });
  };
  const setScale = (v) => onChange({ ...value, scale: v });

  const configText =
    `export const WORLD_TRANSFORM = {\n` +
    `  position: [${value.position.map((n) => round(n)).join(', ')}],\n` +
    `  rotation: [${value.rotation.map((n) => round(n)).join(', ')}], // ${rotDeg.join('°, ')}°\n` +
    `  scale: ${round(value.scale)},\n` +
    `};`;

  if (!open) {
    return (
      <button style={{ ...panel, width: 'auto' }} onClick={() => setOpen(true)}>
        tune ▸
      </button>
    );
  }

  return (
    <div style={panel}>
      <div style={row}>
        <strong>WORLD_TRANSFORM</strong>
        <button onClick={() => setOpen(false)}>×</button>
      </div>

      {['x', 'y', 'z'].map((ax, i) => (
        <Slider
          key={`p${ax}`}
          label={`pos ${ax}`}
          min={-20}
          max={20}
          step={0.05}
          value={value.position[i]}
          onChange={(v) => setPos(i, v)}
        />
      ))}

      {['x', 'y', 'z'].map((ax, i) => (
        <Slider
          key={`r${ax}`}
          label={`rot ${ax}`}
          min={-180}
          max={180}
          step={1}
          value={rotDeg[i]}
          unit="°"
          onChange={(v) => setRotDeg(i, v)}
        />
      ))}

      <Slider label="scale" min={0.05} max={5} step={0.01} value={value.scale} onChange={setScale} />

      <textarea readOnly value={configText} style={ta} />
      <button
        style={{ width: '100%', padding: '6px 0' }}
        onClick={() => navigator.clipboard?.writeText(configText)}
      >
        Copy config
      </button>
    </div>
  );
}

function Slider({ label, min, max, step, value, unit = '', onChange }) {
  return (
    <label style={{ display: 'block', margin: '4px 0' }}>
      <div style={row}>
        <span>{label}</span>
        <span>
          {round(value)}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%' }}
      />
    </label>
  );
}

const round = (n) => Math.round(n * 1000) / 1000;

const panel = {
  position: 'fixed',
  top: 12,
  right: 12,
  zIndex: 10,
  width: 240,
  padding: 12,
  background: 'rgba(20,20,24,0.9)',
  color: '#eee',
  font: '12px monospace',
  borderRadius: 8,
  border: '1px solid #444',
};
const row = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const ta = {
  width: '100%',
  height: 78,
  marginTop: 8,
  background: '#111',
  color: '#8f8',
  border: '1px solid #333',
  fontSize: 11,
  resize: 'none',
};
