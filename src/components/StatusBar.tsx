import { useEffect, useState } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { deviceConfig } from '../config';

export default function StatusBar() {
  const online = useOnlineStatus();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="status-bar">
      <div className="status-bar-left">
        <span className="status-chip"><span className="dot" style={{ background: 'var(--slate)' }} /> System Secure</span>
        <span className={`status-chip ${online ? 'online' : 'offline'}`}>
          <span className="dot" /> {online ? 'Online' : 'Offline'}
        </span>
        {deviceConfig.current?.entryPointName && (
          <span className="status-chip">{deviceConfig.current.entryPointName}</span>
        )}
      </div>
      <span className="clock">{time}</span>
    </div>
  );
}
