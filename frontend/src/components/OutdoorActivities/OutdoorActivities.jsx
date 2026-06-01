const ACTIVITY_CONFIG = {
  jogging: {
    label: "Jogging / Running",
    icon: "🏃",
    thresholds: { good: 50, caution: 100, avoid: 150 },
  },
  cycling: {
    label: "Cycling",
    icon: "🚴",
    thresholds: { good: 50, caution: 100, avoid: 150 },
  },
  children: {
    label: "Children Playing Outside",
    icon: "👧",
    thresholds: { good: 50, caution: 75, avoid: 100 },  // stricter for kids
  },
  elderly: {
    label: "Elderly Outdoor Activity",
    icon: "🧓",
    thresholds: { good: 50, caution: 75, avoid: 100 },  // stricter for elderly
  },
  windows: {
    label: "Open Windows",
    icon: "🪟",
    thresholds: { good: 100, caution: 150, avoid: 200 },
  },
  school: {
    label: "School Outdoor Activities",
    icon: "🏫",
    thresholds: { good: 50, caution: 75, avoid: 100 },  // stricter for schools
  },
};

function getActivityStatus(aqiValue, thresholds) {
  if (aqiValue <= thresholds.good) {
    return {
      status: "Safe",
      color: "#2f9e44",
      bg: "#ebfbee",
      border: "rgba(47,158,68,0.25)",
      icon: "✅",
      advice: "Recommended",
    };
  }
  if (aqiValue <= thresholds.caution) {
    return {
      status: "Caution",
      color: "#e67700",
      bg: "#fff9db",
      border: "rgba(230,119,0,0.25)",
      icon: "⚠️",
      advice: "With precautions",
    };
  }
  if (aqiValue <= thresholds.avoid) {
    return {
      status: "Limit",
      color: "#e03131",
      bg: "#fff5f5",
      border: "rgba(224,49,49,0.25)",
      icon: "🚫",
      advice: "Limit exposure",
    };
  }
  return {
    status: "Avoid",
    color: "#7f1d1d",
    bg: "#fecaca22",
    border: "rgba(127,29,29,0.25)",
    icon: "⛔",
    advice: "Not recommended",
  };
}

export default function OutdoorActivities({ aqiValue }) {
  const safeAqi = Number(aqiValue) || 0;

  return (
    <div className="outdoor-activities-wrapper">
      <div className="outdoor-activities-title">
        <strong>Outdoor activity guide</strong>
        <span>Based on current AQI of {safeAqi}</span>
      </div>

      <div className="outdoor-activities-grid">
        {Object.entries(ACTIVITY_CONFIG).map(([key, activity]) => {
          const result = getActivityStatus(safeAqi, activity.thresholds);
          return (
            <div
              key={key}
              className="outdoor-activity-card"
              style={{
                background: result.bg,
                border: `1px solid ${result.border}`,
              }}
            >
              <div className="outdoor-activity-top">
                <span className="outdoor-activity-icon">{activity.icon}</span>
                <span
                  className="outdoor-activity-status"
                  style={{ color: result.color }}
                >
                  {result.icon} {result.status}
                </span>
              </div>
              <div className="outdoor-activity-label">{activity.label}</div>
              <div
                className="outdoor-activity-advice"
                style={{ color: result.color }}
              >
                {result.advice}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
