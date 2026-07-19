import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { deviceConfig } from '../config';

export default function Unlocked() {
  const navigate = useNavigate();
  const entryPointName = deviceConfig.current?.entryPointName ?? 'Door';

  useEffect(() => {
    const t = setTimeout(() => navigate('/'), 4000);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="unlock-screen">
      <div className="unlock-badge">✓</div>
      <div className="unlock-title">{entryPointName} is open — please enter</div>
      <p className="unlock-sub">Returning to home…</p>
    </div>
  );
}
