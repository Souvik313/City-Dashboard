import { useEffect, useState } from 'react';
import axios from 'axios';
import IncidentAnalytics from '../IncidentAnalytics/IncidentAnalytics.jsx';
import './IncidentReport.css';

const API_URL = 'http://localhost:5000';
const categories = [
  'Pothole',
  'Broken streetlight',
  'Waste issue',
  'Flooding',
  'Public Safety',
  'Fire Hazard',
  'Other',
];

export default function IncidentReport({ city, onSelectIncident, selectedIncident, onCloseIncident }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [address, setAddress] = useState('');
  const [photoData, setPhotoData] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [analyticsRefreshKey, setAnalyticsRefreshKey] = useState(0);
  useEffect(() => {
    if (!city?._id) {
      setIncidents([]);
      return;
    }

    const fetchIncidents = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/v1/incidents`, {
          params: { cityId: city._id },
        });
        setIncidents(response.data.incidents || []);
      } catch (err) {
        console.error(err);
        setError('Could not load incident reports.');
      }
    };

    fetchIncidents();
  }, [city?._id]);

  useEffect(() => {
    if (!success) return;

    const timer = window.setTimeout(() => {
      setSuccess(null);
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [success]);

  const handlePhotoChange = (event) => {
    const file = event.target.files[0];
    if (!file) {
      setPhotoData('');
      setPhotoPreview('');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        setPhotoPreview(result);
        setPhotoData(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory(categories[0]);
    setAddress('');
    setPhotoData('');
    setPhotoPreview('');
  };

  const handleRemovePhoto = () => {
    setPhotoData('');
    setPhotoPreview('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!city?._id) {
      setError('Select a city before reporting an incident.');
      return;
    }

    if (!title || !description) {
      setError('Please provide a title and description.');
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const payload = {
        title,
        description,
        category,
        address,
        cityId: city._id,
        photoData: photoData || undefined,
      };

      await axios.post(`${API_URL}/api/v1/incidents`, payload, { headers });

      setSuccess('Report submitted. Local authorities can now track it.');
      resetForm();

      const response = await axios.get(`${API_URL}/api/v1/incidents`, {
        params: { cityId: city._id },
      });
      setIncidents(response.data.incidents || []);
      setAnalyticsRefreshKey((key) => key + 1);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || 'Unable to submit incident.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="incident-report-card">
      {selectedIncident ? (
        <div className="incident-detail-panel">
          <div className="incident-card-header">
            <h2>📢 Report detail</h2>
            <p className="incident-description">Review the selected incident and close to return to reporting.</p>
          </div>
          <div className="incident-detail-grid">
            <div>
              <strong>{selectedIncident.title}</strong>
              <div className="incident-detail-meta-row">
                <span className={`incident-status status-${(selectedIncident.status || '').replace(/\s+/g, '-').toLowerCase()}`}>{selectedIncident.status}</span>
                <span className="incident-category">{selectedIncident.category}</span>
              </div>
              <p>{selectedIncident.description}</p>
              {selectedIncident.address && <div className="incident-meta">Location: {selectedIncident.address}</div>}
              <div className="incident-meta">Reported: {new Date(selectedIncident.createdAt).toLocaleString()}</div>
            </div>
            {selectedIncident.photo && (
              <div className="incident-detail-photo">
                <img src={selectedIncident.photo} alt="Report" />
              </div>
            )}
          </div>
          <button type="button" className="btn-primary incident-close-btn" onClick={onCloseIncident || (() => {})}>
            Close
          </button>
        </div>
      ) : (
        <>
          <IncidentAnalytics city={city} refreshKey={analyticsRefreshKey} />

          <div className="incident-card-header">
            <h2>📢 Report a city issue</h2>
            <p className="incident-description">
              Spot It. Report It. Improve Your City.
            </p>
          </div>

          <form className="incident-report-form" onSubmit={handleSubmit}>
            <label>
              Issue title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short summary"
                required
              />
            </label>

            <label>
              Category
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label>
              Description
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="What is happening and where?"
                required
              />
            </label>

            <label>
              Location details
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, neighborhood, landmark"
              />
            </label>

            <label className="photo-upload-label">
              Photo (optional)
              <div className="photo-upload-box">
                <input type="file" accept="image/*" onChange={handlePhotoChange} />
                <div className="photo-upload-content">
                  <div className="photo-upload-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path d="M5 20h14a1 1 0 0 0 1-1v-3a1 1 0 1 0-2 0v2H6v-2a1 1 0 1 0-2 0v3a1 1 0 0 0 1 1Zm7-14l4 4h-3v4h-2v-4H8l4-4Z" />
                    </svg>
                  </div>
                  <span>Click or drag an image here</span>
                  <small>Supported formats: JPG, PNG, GIF</small>
                </div>
              </div>
            </label>

            {photoPreview && (
              <div className="photo-preview">
                <div className="photo-preview-header">
                  <span>Photo preview</span>
                  <button type="button" className="photo-remove-btn" onClick={handleRemovePhoto}>
                    Remove
                  </button>
                </div>
                <div className="photo-preview-image">
                  <img src={photoPreview} alt="Incident preview" />
                </div>
              </div>
            )}

            {error && <div className="incident-error">{error}</div>}
            {success && <div className="incident-success">{success}</div>}

            <button type="submit" className="btn-primary" disabled={loading || !title || !address}>
              {loading ? 'Submitting…' : 'Submit report'}
            </button>
          </form>

          <section className="incident-list-section">
            <h3>{incidents.length ? `Recent reports in ${city?.name}` : 'No reports yet'}</h3>
            {incidents.length > 0 ? (
              <div className="incident-list compact-list">
                {incidents.map((incident) => (
                  <article
                    key={incident._id}
                    className="incident-card-item compact"
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectIncident && onSelectIncident(incident)}
                    onKeyDown={(e) => { if (e.key === 'Enter') onSelectIncident && onSelectIncident(incident); }}
                  >
                    <header>
                      <div>
                        <strong>{incident.title}</strong>
                        <div className="incident-sub">
                          <span className="incident-category">{incident.category}</span>
                          <span className={`incident-status status-${(incident.status || '').replace(/\s+/g, '-').toLowerCase()}`}>
                            {incident.status}
                          </span>
                        </div>
                      </div>
                    </header>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty">No incident reports for this city yet.</div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
