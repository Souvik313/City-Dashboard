import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip
} from "recharts";

const COLORS = [
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#7c3aed"
];

export default function CrowdingDistributionChart({
  routes = []
}) {
  const counts = {
    low: 0,
    medium: 0,
    high: 0,
    full: 0
  };

  routes.forEach((route) => {
    counts[route.crowdLevel]++;
  });

  const data = Object.entries(counts).map(
    ([name, value]) => ({
      name,
      value
    })
  );

  return (
    <div className="transit-section">
      <div className="section-header">
        <h4>Crowding Distribution</h4>
      </div>

      <div
        style={{
          width: "100%",
          height: 250
        }}
      >
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              outerRadius={80}
              label
            >
              {data.map((entry, index) => (
                <Cell
                  key={index}
                  fill={COLORS[index]}
                />
              ))}
            </Pie>

            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}