import { useState } from 'react';

const DEG = 180 / Math.PI;
const round = (n) => Math.round(n * 1000) / 1000;

// DOM panel for the wall placer. Edit position/rotation/scale as exact numbers,
// or nudge with the keyboard (see App). "size" is the wall's measured full
// dimensions. Capture each placement into a paste-ready WALLS array.
export default function WallReadout({
  pos,
  rotDeg,
  scale,
  setPos,
  setRotAxisDeg,
  setScale,
  measured,
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

  const line = (w) =>
    `  { half: [${w.half.map(round).join(', ')}], position: [${w.position
      .map(round)
      .join(', ')}], rotation: [${w.rotation.map(round).join(', ')}] },`;

  const configText = `export const WALLS = [\n${captured.map(line).join('\n')}\n];`;

  return (
    <div style={panel}>
      <strong>Wall placer</strong>

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

      <div style={{ margin: '8px 0' }}>
        <div style={rowLabel}>scale</div>
        <input
          type="number"
          step="0.1"
          value={round(scale)}
          onChange={(e) => setScale(Math.max(0.01, parseFloat(e.target.value) || 0.01))}
          style={num}
        />
      </div>

      <div style={{ margin: '6px 0', opacity: 0.8 }}>
        size&nbsp;[{measured ? measured.half.map((h) => round(h * 2)).join(', ') : '…'}] (full)
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        <button style={btn} onClick={onCapture} disabled={!measured}>
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
            Copy WALLS
          </button>
        </>
      )}

      <div style={{ marginTop: 8, opacity: 0.6, fontSize: 10, lineHeight: 1.5 }}>
        Camera: WASD fly · Q/E up-down · Shift boost · drag look
        <br />
        Wall: click floor = place · scale , .
        <br />
        Rotate: yaw [ ] · pitch ; ' · roll N/M
        <br />
        Fine move: J/L=x U/O=y I/K=z · Shift=big step
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
const btn = { flex: 1, padding: '5px 0', background: '#222', color: '#eee', border: '1px solid #333' };
const axBtn = {
  width: 24,
  padding: '3px 0',
  background: '#222',
  color: '#eee',
  border: '1px solid #333',
  cursor: 'pointer',
};
const stepBtn = {
  width: 26,
  padding: '2px 0',
  color: '#eee',
  border: '1px solid #333',
  fontSize: 10,
  cursor: 'pointer',
};
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
