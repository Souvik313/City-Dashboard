const typeConfig = {
  hospital:      { icon: "🏥", label: "Hospital",       color: "emergency-red"    },
  clinic:        { icon: "🏥", label: "Clinic",         color: "emergency-red"    },
  doctors:       { icon: "👨‍⚕️", label: "Doctor",        color: "emergency-red"    },
  police:        { icon: "🚔", label: "Police Station", color: "emergency-blue"   },
  fire_station:  { icon: "🚒", label: "Fire Station",   color: "emergency-orange" },
  pharmacy:      { icon: "💊", label: "Pharmacy",       color: "emergency-green"  },
};

export default function EmergencyPlaceCard({ place }) {
  const config = typeConfig[place.type] || {
    icon: "📍", label: place.type, color: "emergency-default"
  };

  const handleDirections = () => {
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}`,
      "_blank"
    );
  };

  const handleCall = () => {
    window.location.href = `tel:${place.phone}`;
  };

  return (
    <div className={`emergency-place-card ${config.color}`}>

      <div className="emergency-place-header">
        <div className="emergency-place-icon">
          {config.icon}
        </div>
        <div className="emergency-place-info">
          <h4>{place.name}</h4>
          <span className="emergency-place-type">{config.label}</span>
        </div>
        <div className="emergency-place-distance">
          <strong>{place.distance}</strong>
          <span>km</span>
        </div>
      </div>

      {place.address && (
        <p className="emergency-place-address">
          📍 {place.address}
        </p>
      )}

      {place.openingHours && (
        <p className="emergency-place-hours">
          🕐 {place.openingHours}
        </p>
      )}

      <div className="emergency-place-actions">
        <button
          className="emergency-action-btn directions"
          onClick={handleDirections}
        >
          🗺️ Directions
        </button>

        {place.phone && (
          <button
            className="emergency-action-btn call"
            onClick={handleCall}
          >
            📞 Call
          </button>
        )}
      </div>

    </div>
  );
}