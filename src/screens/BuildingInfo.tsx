import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type SiteInfo } from '../api/client';
import { deviceConfig } from '../config';
import { getCachedSiteInfo, fetchAndCacheSiteInfo } from '../keyCache';
import BottomNav from '../components/BottomNav';

export default function BuildingInfo() {
  const navigate = useNavigate();
  const [site, setSite] = useState<SiteInfo | null>(getCachedSiteInfo);

  useEffect(() => {
    const siteId = deviceConfig.current?.siteId ?? '';
    fetchAndCacheSiteInfo(siteId).then((fresh) => { if (fresh) setSite(fresh); });
  }, []);

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="back-btn" onClick={() => navigate('/')}>←</div>
        <div className="screen-title">Building Info</div>
      </div>
      <div className="simple-section">
        {site?.buildingInfo ? (
          <div className="info-block">{site.buildingInfo}</div>
        ) : (
          <div className="info-block empty">
            No building info has been set for this site yet. Property staff can
            add announcements from the dashboard's Branding & Panel Settings screen.
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
