import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import './Alerts.css';

const API_URL = import.meta.env.VITE_APP_API_URL || 'http://localhost:5000';

export default function Alerts({ city, small }) {
  const [socketConnected, setSocketConnected] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    // connect socket
    const s = io(API_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = s;

    s.on('connect', () => setSocketConnected(true));
    s.on('disconnect', () => setSocketConnected(false));

    s.on('alert', (payload) => {
      setAlerts((prev) => [payload, ...prev]);
      setUnreadCount((c) => c + 1);
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    // join city room when city changes
    if (!socketRef.current) return;
    if (city && city._id) {
      socketRef.current.emit('join', city._id);
      // fetch recent alerts for city
      (async () => {
        try {
          const res = await axios.get(`${API_URL}/api/v1/alerts?cityId=${city._id}`);
          if (res.data && res.data.alerts) {
            setAlerts(res.data.alerts);
            const unread = res.data.alerts.filter(a => !a.acknowledged).length;
            setUnreadCount(unread);
          }
        } catch (err) {
          console.warn('Failed to fetch alerts', err?.message || err);
        }
      })();
    }

    return () => {
      if (socketRef.current && city && city._id) socketRef.current.emit('leave', city._id);
    };
  }, [city]);

  const acknowledge = async (id) => {
    try {
      await axios.patch(`${API_URL}/api/v1/alerts/${id}/ack`);
      setAlerts(prev => prev.map(a => a._id === id ? { ...a, acknowledged: true } : a));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.warn('Ack failed', err?.message || err);
    }
  };

  return (
    <div className={`alerts-root ${small ? 'small' : ''}`}> 
      <button className="alerts-bell" onClick={() => setOpen(o => !o)} aria-label="Open alerts">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/></svg>
        {unreadCount > 0 && <span className="alerts-badge">{unreadCount}</span>}
      </button>

      {open && (
        <div className="alerts-panel">
          <div className="alerts-panel-header">
            <strong>Alerts</strong>
            <span className="muted">{socketConnected ? 'live' : 'offline'}</span>
          </div>
          <div className="alerts-list">
            {alerts.length === 0 && <div className="muted">No alerts</div>}
            {alerts.map(alert => (
              <div key={alert._id || alert.createdAt} className={`alert-item ${alert.acknowledged ? 'ack' : ''}`}>
                <div className="alert-main">
                  <div className="alert-title">{alert.title}</div>
                  <div className="alert-msg">{alert.message}</div>
                  <div className="alert-meta">{alert.priority} • {new Date(alert.createdAt).toLocaleString()}</div>
                </div>
                {!alert.acknowledged && (
                  <div className="alert-actions">
                    <button onClick={() => acknowledge(alert._id)} className="btn-small">Acknowledge</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
