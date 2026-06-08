export default function HealthResultCard({ result }) {
  const handleDirections = () => {
    window.open(
      `https://www.google.com/maps/dir/?api=1` +
      `&destination=${result.lat},${result.lon}`,
      "_blank"
    );
  };

  const handleCall = () => {
    window.location.href = `tel:${result.phone}`;
  };

  return (
    <div className={`health-result-card
      ${result.specialtyMatch ? "specialty-match" : ""}`}>

      {result.specialtyMatch && (
        <div className="health-specialty-badge">
          ⭐ Specialist Match
        </div>
      )}

      <div className="health-result-header">
        <div className="health-result-icon">
          {result.type === "hospital" ? "🏥"
            : result.type === "clinic" ? "🏨"
            : result.type === "dentist" ? "🦷"
            : "👨‍⚕️"}
        </div>
        <div className="health-result-info">
          <h4>{result.name}</h4>
          <span className="health-result-type">
            {result.type}
            {result.emergency && (
              <span className="health-emergency-tag">🚨 24h Emergency</span>
            )}
          </span>
        </div>
        <div className="health-result-distance">
          <strong>{result.distance}</strong>
          <span>km</span>
        </div>
      </div>

      {result.address && (
        <p className="health-result-address">📍 {result.address}</p>
      )}

      {result.openingHours && (
        <p className="health-result-hours">🕐 {result.openingHours}</p>
      )}

      <div className="health-result-actions">
        <button
          className="health-action-btn directions"
          onClick={handleDirections}
        >
          🗺️ Directions
        </button>
        {result.phone && (
          <button
            className="health-action-btn call"
            onClick={handleCall}
          >
            📞 Call
          </button>
        )}
        {result.website && (
          
            <a href={result.website}
            target="_blank"
            rel="noreferrer"
            className="health-action-btn website"
          >
            🌐 Website
          </a>
        )}
      </div>
    </div>
  );
}