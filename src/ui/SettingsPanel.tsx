import { useState, useSyncExternalStore } from 'react';
import { getSettings, setSettings, subscribeSettings, type Settings } from './settings';

/** The gear in the corner and the settings sheet it opens: volumes and animation speed. */
export function SettingsButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="gear" onClick={() => setOpen((o) => !o)} title="Settings" data-testid="btn-settings" aria-label="Settings">
        ⚙
      </button>
      {open && <SettingsSheet onClose={() => setOpen(false)} />}
    </>
  );
}

function SettingsSheet({ onClose }: { onClose: () => void }) {
  const s = useSyncExternalStore(subscribeSettings, getSettings);
  const speeds: { v: Settings['speed']; label: string }[] = [
    { v: 0.5, label: 'Slow' },
    { v: 1, label: 'Normal' },
    { v: 2, label: 'Fast' },
    { v: 0, label: 'Instant' },
  ];
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal settings" onClick={(e) => e.stopPropagation()} data-testid="settings">
        <h2>Settings</h2>
        <label>
          <span>Sound effects</span>
          <input type="range" min={0} max={1} step={0.05} value={s.sfx} onChange={(e) => setSettings({ sfx: Number(e.target.value) })} data-testid="set-sfx" />
          <span className="val">{Math.round(s.sfx * 100)}%</span>
        </label>
        <label>
          <span>Music</span>
          <input type="range" min={0} max={1} step={0.05} value={s.music} onChange={(e) => setSettings({ music: Number(e.target.value) })} data-testid="set-music" />
          <span className="val">{Math.round(s.music * 100)}%</span>
        </label>
        <div className="speedrow">
          <span>Animation speed</span>
          {speeds.map((o) => (
            <button key={o.label} className={s.speed === o.v ? 'primary small' : 'small'} onClick={() => setSettings({ speed: o.v })} data-testid={`set-speed-${o.label.toLowerCase()}`}>
              {o.label}
            </button>
          ))}
        </div>
        <p className="muted">Keys in battle: E or Enter ends the turn, Escape clears the selection.</p>
        <div className="row">
          <button className="primary" onClick={onClose} data-testid="btn-settings-close">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
