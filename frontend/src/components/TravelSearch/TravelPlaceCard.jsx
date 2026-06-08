const TYPE_ICONS = {
  hotel:            "🏨",
  motel:            "🏩",
  resort:           "🏖️",
  hostel:           "🛏️",
  guest_house:      "🏠",
  bed_and_breakfast:"☕",
  restaurant:       "🍽️",
  fast_food:        "🍔",
  cafe:             "☕",
  food_court:       "🍱",
  attraction:       "🗺️",
  museum:           "🏛️",
  viewpoint:        "🌅",
  monument:         "🗽",
};

export default function TravelPlaceCard({ place }) {
  const handleDirections = () => {
    window.open(
      `https://www.google.com/maps/dir/?api=1` +
      `&destination=${place.lat},${place.lon}`,
      "_blank"
    );
  };

  return (
    <div className="travel-place-card">

      <div className="travel-place-header">
        <div className="travel-place-icon">
          {TYPE_ICONS[place.type] || "📍"}
        </div>
        <div className="travel-place-info">
          <h4>{place.name}</h4>
          <div className="travel-place-meta">
            <span className="travel-place-type">
              {place.type?.replace(/_/g, " ")}
            </span>
            {place.stars && (
              <span className="travel-stars">
                {"⭐".repeat(Math.min(parseInt(place.stars), 5))}
              </span>
            )}
            {place.cuisine && (
              <span className="travel-cuisine">🍴 {place.cuisine}</span>
            )}
          </div>
        </div>
        <div className="travel-place-distance">
          <strong>{place.distance}</strong>
          <span>km</span>
        </div>
      </div>

      {place.address && (
        <p className="travel-place-address">📍 {place.address}</p>
      )}

      {place.openingHours && (
        <p className="travel-place-hours">🕐 {place.openingHours}</p>
      )}

      {place.wheelchair && (
        <p className="travel-place-accessible">♿ Wheelchair accessible</p>
      )}

      <div className="travel-place-actions">
        <button
          className="travel-action-btn directions"
          onClick={handleDirections}
        >
          🗺️ Directions
        </button>
        {place.phone && (
          <button
            className="travel-action-btn call"
            onClick={() => { window.location.href = `tel:${place.phone}`; }}
          >
            📞 Call
          </button>
        )}
        {place.website && (
          
            <a href={place.website}
            target="_blank"
            rel="noreferrer"
            className="travel-action-btn website"
          >
            🌐 Website
          </a>
        )}
      </div>

    </div>
  );
}