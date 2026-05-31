import React from 'react';
import './AQIGauge.css';

const AQIGauge = ({ aqiValue = 0, category = 'Good' }) => {
  const maxAQI = 500;
  const percentage = Math.min((aqiValue / maxAQI) * 100, 100);
  
  const getGaugeColor = (value) => {
    if (value <= 50) return '#22c55e';
    if (value <= 100) return '#eab308';
    if (value <= 150) return '#f97316';
    if (value <= 200) return '#ef4444';
    if (value <= 300) return '#7c3aed';
    return '#7c2d12';
  };

  const gaugeColor = getGaugeColor(aqiValue);
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="aqi-gauge-container">
      <div className="aqi-gauge-wrapper">
        <svg className="aqi-gauge-svg" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="45" className="aqi-gauge-bg" />
          <circle
            cx="60"
            cy="60"
            r="45"
            className="aqi-gauge-progress"
            style={{
              strokeDashoffset: strokeDashoffset,
              stroke: gaugeColor,
            }}
          />
        </svg>

        <div className="aqi-gauge-content">
          <div className="aqi-gauge-value">{Math.round(aqiValue)}</div>
          <div className="aqi-gauge-label">AQI</div>
          <div className={`aqi-gauge-category ${category?.toLowerCase().replace(/ /g, '-')}`}>
            {category}
          </div>
        </div>

        <div 
          className={`aqi-gauge-glow ${aqiValue > 150 ? 'warning' : ''}`}
          style={{ background: `radial-gradient(circle, ${gaugeColor}40, transparent)` }}
        />
      </div>

      <div className="aqi-gauge-scale">
        <div className="aqi-scale-item"><span className="aqi-scale-dot" style={{ background: '#22c55e' }} /><span className="aqi-scale-text">0-50</span></div>
        <div className="aqi-scale-item"><span className="aqi-scale-dot" style={{ background: '#eab308' }} /><span className="aqi-scale-text">51-100</span></div>
        <div className="aqi-scale-item"><span className="aqi-scale-dot" style={{ background: '#f97316' }} /><span className="aqi-scale-text">101-150</span></div>
        <div className="aqi-scale-item"><span className="aqi-scale-dot" style={{ background: '#ef4444' }} /><span className="aqi-scale-text">151-200</span></div>
        <div className="aqi-scale-item"><span className="aqi-scale-dot" style={{ background: '#7c3aed' }} /><span className="aqi-scale-text">201-300</span></div>
        <div className="aqi-scale-item"><span className="aqi-scale-dot" style={{ background: '#7c2d12' }} /><span className="aqi-scale-text">300+</span></div>
      </div>
    </div>
  );
};

export default AQIGauge;
