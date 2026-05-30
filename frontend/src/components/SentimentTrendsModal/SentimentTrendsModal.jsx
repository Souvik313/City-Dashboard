import SentimentPanel from "../SentimentPanel/SentimentPanel.jsx";
import "./SentimentTrendsModal.css";

export default function SentimentTrendsModal({ cityName, onClose }) {
  return (
    <div className="sentiment-trends-overlay" onClick={onClose}>
      <div className="sentiment-trends-modal sentiment-trends-modal-wide" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="sentiment-trends-close sentiment-trends-close-floating"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
        <div className="sentiment-trends-body sentiment-trends-body-embedded">
          <SentimentPanel cityName={cityName} compact />
        </div>
      </div>
    </div>
  );
}
