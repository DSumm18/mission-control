'use client';

import { useCallback, useEffect, useState } from 'react';
import { Cpu, HardDrive, MemoryStick } from 'lucide-react';

type Vitals = {
  cpu: { percent: number; cores: number };
  memory: { total_gb: number; used_gb: number; free_gb: number; percent: number };
  disk: { total_gb: number; used_gb: number; free_gb: number; percent: number };
  uptime: string;
  load_avg: number;
};

function barColor(percent: number): string {
  if (percent >= 90) return 'var(--bad)';
  if (percent >= 70) return 'var(--warn)';
  return 'var(--good)';
}

function VitalBar({ label, percent, detail, icon }: {
  label: string;
  percent: number;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500 }}>
          {icon} {label}
        </div>
        <span className="muted" style={{ fontSize: 11 }}>{detail}</span>
      </div>
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{
            width: `${Math.min(percent, 100)}%`,
            background: barColor(percent),
          }}
        />
      </div>
    </div>
  );
}

export default function SystemVitals() {
  const [vitals, setVitals] = useState<Vitals | null>(null);

  const fetchVitals = useCallback(() => {
    fetch('/api/vitals', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (!d.error) setVitals(d); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchVitals();
    const interval = setInterval(fetchVitals, 30_000);
    return () => clearInterval(interval);
  }, [fetchVitals]);

  if (!vitals) {
    return (
      <div>
        <div className="skeleton skeleton-text" />
        <div className="skeleton skeleton-text" />
        <div className="skeleton skeleton-text" />
      </div>
    );
  }

  return (
    <div>
      <VitalBar
        label="CPU"
        percent={vitals.cpu.percent}
        detail={`${vitals.cpu.percent}% (${vitals.cpu.cores} cores)`}
        icon={<Cpu size={13} color="var(--accent)" />}
      />
      <VitalBar
        label="Memory"
        percent={vitals.memory.percent}
        detail={`${vitals.memory.used_gb}/${vitals.memory.total_gb} GB`}
        icon={<MemoryStick size={13} color="var(--accent)" />}
      />
      <VitalBar
        label="Disk"
        percent={vitals.disk.percent}
        detail={`${vitals.disk.free_gb} GB free`}
        icon={<HardDrive size={13} color="var(--accent)" />}
      />
      <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
        Uptime: {vitals.uptime} | Load: {vitals.load_avg.toFixed(2)}
      </div>
    </div>
  );
}
