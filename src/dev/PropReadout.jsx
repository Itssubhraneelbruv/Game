import { useState } from 'react';

const DEG = 180 / Math.PI;
const round = (n) => Math.round(n * 1000) / 1000;

// DOM panel for the prop placer. Pick a model, position it (click floor / buttons
// / keyboard), tune rotation + scale, drop to floor, then capture into a
// paste-ready PROPS array.
export default function PropReadout({
  urls,
  url,
  setUrl,
  pos,
  setPos,
  rotDeg,
  setRotAxisDeg,
  scale,
  setScale,
  onDropToFloor,
  captured,
  onCapture,
  onUndo,
  onClear,
}) {
  const [step, setStep] = useState(0.5);

  const setAxis = (i, v) => {
    const next = [...pos];
    next[i] = Number.isFinite(v) ? v : 0;
    setPos(next);
  };
  const nudge = (i, d) => setAxis(i, round(pos[i] + d));

  const name = (u) => u.split('/').pop().replace('.glb', '');
  const line = (p) =>
    `  { url: '${p.url}', position: [${p.position.map(round).join(', ')}], rotation: [${p.rotation
      .map(round)
      .join(', ')}], scale: ${round(p.scale)} },`;
  const configText = `export const PROPS = [\n${captured.map(line).join('\n')}\n];`;

  return (
    <div style={panel}>
      <strong>Prop placer</strong>

      <div style={{ display: 'flex', gap: 4, margin: '6px 0' }}>
        {urls.map((u) => (
          <button
            key={u}
            onClick={() => setUrl(u)}
            style={{ ...btn, background: url === u ? '#357' : '#222' }}
          >
            {name(u)}
          </button>
        ))}
      </div>

      <div style={{ margin: '8px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={rowLabel}>position</span>
          <span style={{ display: 'flex', gap: 3 }}>
            {[0.1, 0.5, 1].map((s) => (
              <button
                key={s}
                onClick={() => setStep(s)}
                style={{ ...stepBtn, background: step === s ? '#357' : '#222' }}
              >
                {s}
              </button>
            ))}
          </span>
        </div>
        {['X', 'Y', 'Z'].map((ax, i) => (
          <div key={ax} style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 4 }}>
            <span style={{ width: 12, opacity: 0.7 }}>{ax}</span>
            <button style={axBtn} onClick={() => nudge(i, -step)}>
              −
            </button>
            <input
              type="number"
              step={step}
              value={round(pos[i])}
              onChange={(e) => setAxis(i, parseFloat(e.target.value))}
              style={{ ...num, flex: 1, minWidth: 0 }}
            />
            <button style={axBtn} onClick={() => nudge(i, step)}>
              +
            </button>
          </div>
        ))}
      </div>

      <div style={{ margin: '8px 0' }}>
        <div style={rowLabel}>rotation° (pitch / yaw / roll)</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[0, 1, 2].map((i) => (
            <input
              key={i}
              type="number"
              step="5"
              value={round(rotDeg[i])}
              onChange={(e) => setRotAxisDeg(i, parseFloat(e.target.value) || 0)}
              style={num}
            />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, margin: '8px 0', alignItems: 'flex-end' }}>
        <label style={{ flex: 1 }}>
          <div style={rowLabel}>scale</div>
          <input
            type="number"
            step="0.1"
            value={round(scale)}
            onChange={(e) => setScale(Math.max(0.01, parseFloat(e.target.value) || 0.01))}
            style={num}
          />
        </label>
        <button style={{ ...btn, flex: 1 }} onClick={onDropToFloor}>
          Drop to floor
        </button>
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        <button style={btn} onClick={onCapture}>
          + Capture ({captured.length})
        </button>
        <button style={btn} onClick={onUndo} disabled={!captured.length}>
          Undo
        </button>
        <button style={btn} onClick={onClear} disabled={!captured.length}>
          Clear
        </button>
      </div>

      {captured.length > 0 && (
        <>
          <textarea readOnly value={configText} style={ta} />
          <button style={{ ...btn, width: '100%' }} onClick={() => navigator.clipboard?.writeText(configText)}>
            Copy PROPS
          </button>
        </>
      )}

      <div style={{ marginTop: 8, opacity: 0.6, fontSize: 10, lineHeight: 1.5 }}>
        Click floor = place · J/L=x U/O=y I/K=z
        <br />
        Rotate: yaw [ ] · pitch ; ' · roll N/M · scale , . · Shift=big
      </div>
    </div>
  );
}

const panel = {
  position: 'fixed',
  top: 12,
  left: 12,
  zIndex: 10,
  width: 250,
  padding: 12,
  background: 'rgba(20,20,24,0.9)',
  color: '#eee',
  font: '12px monospace',
  borderRadius: 8,
  border: '1px solid #444',
};
const rowLabel = { opacity: 0.6, marginBottom: 2, fontSize: 11 };
const num = {
  width: '100%',
  background: '#111',
  color: '#eee',
  border: '1px solid #333',
  padding: '4px',
  font: '12px monospace',
};
const btn = { flex: 1, padding: '5px 4px', background: '#222', color: '#eee', border: '1px solid #333' };
const axBtn = { width: 24, padding: '3px 0', background: '#222', color: '#eee', border: '1px solid #333', cursor: 'pointer' };
const stepBtn = { width: 26, padding: '2px 0', color: '#eee', border: '1px solid #333', fontSize: 10, cursor: 'pointer' };
const ta = {
  width: '100%',
  height: 96,
  marginTop: 8,
  background: '#111',
  color: '#8f8',
  border: '1px solid #333',
  fontSize: 10,
  resize: 'none',
};
