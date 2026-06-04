
export default function TransitAlertsPanel({
  alerts = []
}) {
  if (!alerts.length) {
    return (
      <div className="transit-empty">
        No active transit alerts.
      </div>
    );
  }

  return (
    <div className="transit-section">
      <div className="section-header">
        <h4>Service Alerts</h4>
      </div>

      <div className="alerts-list">
        {alerts.map((alert, idx) => (
          <div
            key={alert.alertId || idx}
            className={`alert-card ${alert.severity}`}
          >
            <div className="alert-header">
              <strong>
                {alert.type.replace("_", " ")}
              </strong>

              <span className="severity">
                {alert.severity}
              </span>
            </div>

            <p>{alert.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}