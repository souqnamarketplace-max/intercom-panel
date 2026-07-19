import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';

export default function Security() {
  const navigate = useNavigate();
  return (
    <div className="screen">
      <div className="screen-header">
        <div className="back-btn" onClick={() => navigate('/')}>←</div>
        <div className="screen-title">Security</div>
      </div>
      <div className="simple-section">
        <div className="info-block empty">
          No additional cameras configured for this site yet. This entry point's
          own camera feed is shown on the Home screen.
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
