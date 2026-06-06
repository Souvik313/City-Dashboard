import { useState } from "react";

export default function useUserLocation() {
  const [userLocation, setUserLocation] = useState(null);
  const [error, setError]       = useState(null);
  const [loading, setLoading]   = useState(false);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy  // metres
        });
        setLoading(false);
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError("Location access denied. Please allow location access.");
            break;
          case err.POSITION_UNAVAILABLE:
            setError("Location unavailable. Try again.");
            break;
          case err.TIMEOUT:
            setError("Location request timed out.");
            break;
          default:
            setError("Failed to get location.");
        }
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000   // cache for 1 min
      }
    );
  };

  const openDirections = (destination) => {
  navigator.geolocation.getCurrentPosition((position) => {
    const { latitude, longitude } = position.coords;

    const url =
      `https://www.google.com/maps/dir/?api=1` +
      `&origin=${latitude},${longitude}` +
      `&destination=${destination.latitude},${destination.longitude}`;

    window.open(url, "_blank");
  });
};
  return { userLocation, error, loading, requestLocation, openDirections };
}