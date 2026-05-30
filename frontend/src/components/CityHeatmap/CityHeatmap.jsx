import { useState, useMemo, useCallback } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  Circle,
  InfoWindow,
} from "@react-google-maps/api";
import useCityHeatmapLayers from "../../hooks/useCityHeatmapLayers.js";
import "./CityHeatmap.css";

const MAP_CONTAINER_STYLE = {
  width: "100%",
  height: "100%",
  minHeight: "420px",
  borderRadius: "12px",
};

const DEFAULT_LAYERS = {
  aqi: true,
  weather: true,
  traffic: true,
  incidents: true,
  center: true,
};

function StatPill({ label, value, tone = "default" }) {
  return (
    <div className={`city-heatmap-stat ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function CityHeatmap({ city, aqi, weather, traffic, aqiPrediction }) {
  const [layerVisibility, setLayerVisibility] = useState(DEFAULT_LAYERS);
  const [selectedPoint, setSelectedPoint] = useState(null);

  const { layers, loading, error, refetch } = useCityHeatmapLayers(city, {
    aqi,
    weather,
    traffic,
    enabled: Boolean(city?._id),
  });

  const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: mapsApiKey,
  });

  const toggleLayer = (key) => {
    setLayerVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const mapOptions = useMemo(
    () => ({
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      styles: [
        { elementType: "geometry", stylers: [{ color: "#f5f7fb" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#516074" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#dbeafe" }] },
      ],
    }),
    []
  );

  const onMapLoad = useCallback((map) => {
    if (!layers?.center) return;
    map.panTo(layers.center);
  }, [layers?.center]);

  if (!city) {
    return (
      <div className="city-heatmap-empty">
        Select a city to view the live heatmap.
      </div>
    );
  }

  if (!city.latitude || !city.longitude) {
    return (
      <div className="city-heatmap-empty">
        This city does not have coordinates yet, so the heatmap cannot be rendered.
      </div>
    );
  }

  const embedUrl = `https://www.google.com/maps?q=${city.latitude},${city.longitude}&z=12&output=embed`;

  return (
    <div className="city-heatmap">
      <div className="city-heatmap-toolbar">
        <div>
          <h3>City heatmap</h3>
          <p>
            Live layers for {city.name}: air quality zone, adverse weather, traffic hotspots,
            and citizen incident reports.
          </p>
        </div>
        <button type="button" className="city-heatmap-refresh" onClick={refetch}>
          Refresh map data
        </button>
      </div>

      <div className="city-heatmap-stats">
        <StatPill label="AQI" value={layers?.aqiZone?.value ?? "—"} tone="aqi" />
        <StatPill
          label="Predicted (1h)"
          value={aqiPrediction?.data?.prediction ?? "—"}
          tone="predict"
        />
        <StatPill label="Hotspots" value={layers?.stats?.hotspotCount ?? 0} tone="traffic" />
        <StatPill label="Open reports" value={layers?.stats?.openIncidents ?? 0} tone="incident" />
        <StatPill label="Congestion" value={layers?.stats?.congestion ?? "—"} tone="default" />
      </div>

      <div className="city-heatmap-controls">
        {[
          { key: "center", label: "City center", color: "#3b5bdb" },
          { key: "aqi", label: "AQI zone", color: layers?.aqiZone?.color || "#10b981" },
          { key: "weather", label: "Weather risk", color: "#3b82f6" },
          { key: "traffic", label: "Traffic hotspots", color: "#ef4444" },
          { key: "incidents", label: "Incident reports", color: "#6366f1" },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            className={`city-heatmap-layer-toggle ${layerVisibility[item.key] ? "active" : ""}`}
            onClick={() => toggleLayer(item.key)}
          >
            <span className="city-heatmap-layer-dot" style={{ background: item.color }} />
            {item.label}
          </button>
        ))}
      </div>

      <div className="city-heatmap-layout">
        <div className="city-heatmap-map-wrap">
          {loading && <div className="city-heatmap-map-overlay">Loading map layers…</div>}
          {error && !loading && (
            <div className="city-heatmap-map-overlay error">Some map data failed to load: {error}</div>
          )}

          {!mapsApiKey || loadError ? (
            <div className="city-heatmap-fallback">
              <iframe
                title={`Map of ${city.name}`}
                src={embedUrl}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <p>
                Add <code>VITE_GOOGLE_MAPS_API_KEY</code> to enable the interactive heatmap with
                layered zones and markers.
              </p>
            </div>
          ) : !isLoaded ? (
            <div className="city-heatmap-map-overlay">Loading Google Maps…</div>
          ) : !layers ? (
            <div className="city-heatmap-map-overlay">Preparing map layers…</div>
          ) : (
            <GoogleMap
              mapContainerStyle={MAP_CONTAINER_STYLE}
              center={layers.center}
              zoom={12}
              options={mapOptions}
              onLoad={onMapLoad}
              onClick={() => setSelectedPoint(null)}
            >
              {layerVisibility.center && (
                <>
                  <Circle
                    center={layers.center}
                    radius={180}
                    options={{
                      fillColor: "#3b5bdb",
                      fillOpacity: 0.2,
                      strokeColor: "#3b5bdb",
                      strokeOpacity: 0.95,
                      strokeWeight: 3,
                      zIndex: 5,
                    }}
                  />
                  <Marker
                    position={layers.center}
                    title={`${city.name} city center`}
                    onClick={() =>
                      setSelectedPoint({
                        id: "center",
                        title: `${city.name} city center`,
                        body: `Coordinates: ${city.latitude.toFixed(4)}, ${city.longitude.toFixed(4)}`,
                      })
                    }
                    icon={{
                      path: window.google.maps.SymbolPath.CIRCLE,
                      scale: 11,
                      fillColor: "#3b5bdb",
                      fillOpacity: 1,
                      strokeColor: "#ffffff",
                      strokeWeight: 3,
                    }}
                    zIndex={20}
                  />
                </>
              )}

              {layerVisibility.aqi && layers.aqiZone.enabled && (
                <Circle
                  center={layers.aqiZone.position}
                  radius={layers.aqiZone.radius}
                  options={{
                    fillColor: layers.aqiZone.color,
                    fillOpacity: layers.aqiZone.opacity,
                    strokeColor: layers.aqiZone.color,
                    strokeOpacity: 0.75,
                    strokeWeight: 2,
                    zIndex: 1,
                  }}
                  onClick={() =>
                    setSelectedPoint({
                      id: "aqi",
                      title: "City-wide AQI zone",
                      body: `${layers.aqiZone.label} · AQI ${layers.aqiZone.value} (${layers.aqiZone.category || "—"})`,
                    })
                  }
                />
              )}

              {layerVisibility.weather && layers.weatherZone.enabled && (
                <Circle
                  center={layers.weatherZone.position}
                  radius={layers.weatherZone.radius}
                  options={{
                    fillColor: layers.weatherZone.color,
                    fillOpacity: layers.weatherZone.opacity,
                    strokeColor: "#2563eb",
                    strokeOpacity: 0.55,
                    strokeWeight: 2,
                    zIndex: 2,
                  }}
                  onClick={() =>
                    setSelectedPoint({
                      id: "weather",
                      title: "Adverse weather area",
                      body: `${layers.weatherZone.label} · ${layers.weatherZone.temperature ?? "—"}°C · humidity ${layers.weatherZone.humidity ?? "—"}%`,
                    })
                  }
                />
              )}

              {layerVisibility.traffic &&
                layers.hotspots.map((spot) => (
                  <Circle
                    key={spot.id}
                    center={spot.position}
                    radius={spot.radius}
                    options={{
                      fillColor: spot.color,
                      fillOpacity: spot.opacity,
                      strokeColor: spot.color,
                      strokeOpacity: 0.85,
                      strokeWeight: 2,
                      zIndex: 3,
                    }}
                    onClick={() =>
                      setSelectedPoint({
                        id: spot.id,
                        title: spot.title,
                        body: `Delay ${spot.meta.delaySeconds != null ? `${Math.round(spot.meta.delaySeconds / 60)} min` : "unknown"} · severity ${spot.meta.severity ?? "—"}`,
                      })
                    }
                  />
                ))}

              {layerVisibility.incidents &&
                layers.incidents.map((incident) => (
                  <Marker
                    key={incident.id}
                    position={incident.position}
                    title={incident.title}
                    onClick={() =>
                      setSelectedPoint({
                        id: incident.id,
                        title: incident.title,
                        body: `${incident.meta.category} · ${incident.meta.status}${incident.meta.address ? ` · ${incident.meta.address}` : ""}`,
                      })
                    }
                    icon={{
                      path: window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                      scale: 5,
                      fillColor: incident.color,
                      fillOpacity: 0.95,
                      strokeColor: "#ffffff",
                      strokeWeight: 1.5,
                      rotation: 180,
                    }}
                    zIndex={15}
                  />
                ))}

              {selectedPoint && (
                <InfoWindow
                  position={
                    selectedPoint.id === "center" || selectedPoint.id === "aqi" || selectedPoint.id === "weather"
                      ? layers.center
                      : layers.hotspots.find((spot) => spot.id === selectedPoint.id)?.position ||
                        layers.incidents.find((item) => item.id === selectedPoint.id)?.position ||
                        layers.center
                  }
                  onCloseClick={() => setSelectedPoint(null)}
                >
                  <div className="city-heatmap-infowindow">
                    <strong>{selectedPoint.title}</strong>
                    <p>{selectedPoint.body}</p>
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          )}
        </div>

        <aside className="city-heatmap-legend">
          <h4>Map legend</h4>
          <ul>
            <li>
              <span className="legend-swatch center" /> City center pin and highlight
            </li>
            <li>
              <span className="legend-swatch aqi" style={{ background: layers?.aqiZone?.color }} />
              AQI influence zone (city-wide estimate)
            </li>
            <li>
              <span className="legend-swatch weather" /> Adverse weather overlay
            </li>
            <li>
              <span className="legend-swatch traffic" /> Traffic delay hotspots
            </li>
            <li>
              <span className="legend-swatch incident" /> Citizen incident reports (with location)
            </li>
          </ul>

          <div className="city-heatmap-legend-notes">
            <p>
              <strong>Tip:</strong> Tap circles or markers for details. Toggle layers above to
              focus on one concern at a time.
            </p>
            <p>
              AQI and weather layers reflect city-level readings centered on {city.name}. Traffic
              hotspots use live road coordinates when available.
            </p>
            {layers?.stats?.incidentCount === 0 && (
              <p className="muted">
                Incident markers appear when reports include map coordinates.
              </p>
            )}
          </div>

          <a
            className="city-heatmap-open-maps"
            href={`https://www.google.com/maps?q=${city.latitude},${city.longitude}&z=12`}
            target="_blank"
            rel="noreferrer"
          >
            Open in Google Maps
          </a>
        </aside>
      </div>
    </div>
  );
}
