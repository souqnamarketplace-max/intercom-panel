import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { panelApi, type ActivityEvent } from '../api/client';
import { deviceConfig } from '../config';

const EVENT_LABELS: Record<string, string> = {
  call_answered: 'Call answered',
  call_missed: 'Call missed',
  call_declined: 'Call declined',
  unlock_app: 'Unlocked via app',
  unlock_pin: 'Unlocked via PIN',
  unlock_virtual_key: 'Unlocked via Virtual Key',
  unlock_card_fob: 'Unlocked via card',
  unlock_admin_override: 'Admin override',
  fire_alarm_triggered: 'Fire alarm triggered',
  failed_pin_attempt: 'Failed PIN attempt',
  failed_fob_attempt: 'Failed card attempt',
};

// method distinguishes the specific PIN type behind a generic unlock_pin
// event - a carrier PIN, a resident's own Door PIN, and a one-time
// Delivery Pass PIN all previously collapsed into the same undifferentiated
// "Unlocked via PIN" line.
const METHOD_LABELS: Record<string, string> = {
  door_pin: 'Door PIN',
  delivery_pass_pin: 'Delivery Pass',
  carrier_pin: 'Carrier PIN',
  virtual_key_qr: 'QR scan',
};

export default function Activity() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const entryPointId = deviceConfig.current?.entryPointId;
    if (!entryPointId) {
      setError('This panel isn\u2019t paired yet');
      setLoading(false);
      return;
    }
    panelApi.getEntryPointActivity(entryPointId)
      .then((res) => { setEvents(res.events); setCursor(res.nextCursor); })
      .catch(() => setError('Could not load activity'))
      .finally(() => setLoading(false));
  }, []);

  async function loadMore() {
    const entryPointId = deviceConfig.current?.entryPointId;
    if (!entryPointId || !cursor) return;
    setLoadingMore(true);
    try {
      const res = await panelApi.getEntryPointActivity(entryPointId, cursor);
      setEvents((prev) => [...prev, ...res.events]);
      setCursor(res.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="back-btn" onClick={() => navigate('/')}>←</div>
        <div className="screen-title">Activity</div>
      </div>
      <div className="simple-section">
        {loading && <p className="muted">Loading\u2026</p>}
        {error && <div className="info-block empty">{error}</div>}
        {!loading && !error && events.length === 0 && (
          <div className="info-block empty">No activity yet at this door.</div>
        )}
        {events.map((e) => (
          <div key={e.id} className="pass-row" style={{ alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                {EVENT_LABELS[e.eventType] ?? e.eventType}
                {e.residentName && <span className="muted"> \u2014 {e.residentName}</span>}
                {e.carrierName && <span className="muted"> \u2014 {e.carrierName}</span>}
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                {new Date(e.createdAt).toLocaleString()}
                {e.method && METHOD_LABELS[e.method] && ` \u00b7 ${METHOD_LABELS[e.method]}`}
              </div>
            </div>
          </div>
        ))}
        {cursor && (
          <button className="btn-text" style={{ marginTop: 12 }} onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading\u2026' : 'Load more'}
          </button>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
