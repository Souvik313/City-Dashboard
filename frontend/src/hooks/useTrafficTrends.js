import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const API_URL = "http://localhost:5000";

/**
 * Fetches traffic trends and history for charts.
 * @param {string|null} cityNameOrId - City name or ObjectId (null to skip fetch)
 * @param {{ period?: '24h' | '7d', withHistory?: boolean }} options
 */
export default function useTrafficTrends(cityNameOrId, options = {}) {
    const { period = "24h", withHistory = true } = options;
    const [trends, setTrends] = useState(null);
    const [history, setHistory] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchTrends = useCallback(async () => {
    if (!cityNameOrId) return;
    setLoading(true);
    setError(null);

    try {
        // Skip /traffic/trends since it doesn't exist yet
        // Only fetch history and derive everything from it
        if (!withHistory) {
            setLoading(false);
            return;
        }

        const historyRes = await axios.get(`${API_URL}/api/v1/traffic/history`, {
            params: {
                city: cityNameOrId,
                limit: period === "7d" ? 200 : 100
            }
        });

        if (historyRes.data?.data?.length) {
            const raw = [...historyRes.data.data].reverse();

            const processed = raw.map(record => {
                const avgSpeed = record.speed?.average ?? 0;
                const freeFlow = record.speed?.freeFlow ?? 0;
                const tti = record.congestion?.travelTimeIndex ?? 1;
                const levelMap = { low: 1, moderate: 2, high: 3 };

                return {
                    recordedAt: record.recordedAt,
                    congestionLevel: record.congestion?.level ?? "low",
                    congestionLevelNumeric: levelMap[record.congestion?.level] ?? 1,
                    travelTimeIndex: parseFloat(tti.toFixed(4)),
                    avgSpeed,
                    freeFlowSpeed: freeFlow,
                    speedLossPct: freeFlow > 0
                        ? parseFloat(((freeFlow - avgSpeed) / freeFlow * 100).toFixed(1))
                        : 0,
                    roadClosureCount: record.roadClosureCount ?? 0,
                    incidentCount: record.incidents?.count ?? 0,
                    confidence: parseFloat(
                        ((record.ingestionMeta?.confidence ?? 0) * 100).toFixed(1)
                    ),
                    hotspotCount: record.hotspots?.length ?? 0,
                    maxDelay: record.hotspots?.length
                        ? Math.max(...record.hotspots.map(h => h.delaySeconds))
                        : 0,
                    avgDelay: record.hotspots?.length
                        ? Math.round(
                            record.hotspots.reduce((sum, h) => sum + h.delaySeconds, 0) /
                            record.hotspots.length
                          )
                        : 0
                };
            });

            // Aggregate road rankings
            const roadDelayMap = {};
            historyRes.data.data.forEach(record => {
                record.hotspots?.forEach(h => {
                    if (!roadDelayMap[h.roadName]) {
                        roadDelayMap[h.roadName] = { totalDelay: 0, count: 0, lat: h.lat, lng: h.lng };
                    }
                    roadDelayMap[h.roadName].totalDelay += h.delaySeconds;
                    roadDelayMap[h.roadName].count += 1;
                });
            });

            const rankedRoads = Object.entries(roadDelayMap)
                .map(([roadName, val]) => ({
                    roadName,
                    avgDelay: Math.round(val.totalDelay / val.count),
                    appearances: val.count,
                    lat: val.lat,
                    lng: val.lng
                }))
                .sort((a, b) => b.avgDelay - a.avgDelay)
                .slice(0, 10);

            // Congestion level distribution
            const levelCounts = { low: 0, moderate: 0, high: 0 };
            historyRes.data.data.forEach(record => {
                const lvl = record.congestion?.level;
                if (lvl && levelCounts[lvl] !== undefined) levelCounts[lvl]++;
            });

            // Derive trends summary from history instead of a separate endpoint
            const speeds = processed.map(r => r.avgSpeed).filter(Boolean);
            const ttis = processed.map(r => r.travelTimeIndex).filter(Boolean);
            const latest = processed[processed.length - 1];

            setTrends({
                current: latest,
                avgSpeed: speeds.length ? (speeds.reduce((a, b) => a + b, 0) / speeds.length).toFixed(1) : null,
                avgTTI: ttis.length ? (ttis.reduce((a, b) => a + b, 0) / ttis.length).toFixed(3) : null,
                dominantLevel: Object.entries(levelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "low"
            });

            setHistory({ timeSeries: processed, rankedRoads, levelCounts });
        } else {
            setHistory(null);
            setTrends(null);
        }

    } catch (err) {
        setError(err?.response?.data?.message || err.message);
        setTrends(null);
        setHistory(null);
    } finally {
        setLoading(false);
    }
}, [cityNameOrId, period, withHistory]);

    useEffect(() => {
        fetchTrends();
    }, [fetchTrends]);

    return { trends, history, loading, error, refetch: fetchTrends };
}