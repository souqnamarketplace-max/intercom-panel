import { useNavigate, useLocation } from 'react-router-dom';

export default function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isActive = (path: string) => pathname === path;

  return (
    <div className="bottom-nav">
      <div className={`bottom-nav-item ${isActive('/') ? 'active' : ''}`} onClick={() => navigate('/')}>
        <div className="nav-icon">⌂</div>
        Home
      </div>
      <div className={`bottom-nav-item ${isActive('/messages') ? 'active' : ''}`} onClick={() => navigate('/messages')}>
        <div className="nav-icon">💬</div>
        Messages
      </div>
      <div className="bottom-nav-center" onClick={() => navigate('/')} title="Home">◆</div>
      <div className={`bottom-nav-item ${isActive('/settings') ? 'active' : ''}`} onClick={() => navigate('/settings')}>
        <div className="nav-icon">⚙</div>
        Settings
      </div>
    </div>
  );
}
