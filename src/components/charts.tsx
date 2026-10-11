"use client";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
export function ActivityChart({
  data,
}: {
  data: { day: string; issues: number; returns: number }[];
}) {
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, bottom: 0, left: -28 }}
        >
          <defs>
            <linearGradient id="issueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b96f50" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#b96f50" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 4"
            vertical={false}
            stroke="#eae5df"
          />
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#8a827a", fontSize: 11 }}
            dy={8}
          />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#8a827a", fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 10,
              borderColor: "#e7e0d8",
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="issues"
            name="Issued"
            stroke="#b96f50"
            strokeWidth={2.5}
            fill="url(#issueFill)"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="returns"
            name="Returned"
            stroke="#7f9173"
            strokeWidth={2}
            fill="transparent"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function AvailabilityChart({
  available,
  issued,
  other,
}: {
  available: number;
  issued: number;
  other: number;
}) {
  const data = [
    { name: "Available", value: available, color: "#829078" },
    { name: "Issued", value: issued, color: "#bb795b" },
    { name: "Other", value: other, color: "#e4d8c9" },
  ];
  const total = available + issued + other;
  return (
    <div className="availability">
      <div className="donut">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={
                total
                  ? data
                  : [{ name: "No copies", value: 1, color: "#e4d8c9" }]
              }
              dataKey="value"
              innerRadius={66}
              outerRadius={83}
              paddingAngle={total ? 4 : 0}
              stroke="none"
              isAnimationActive={false}
            >
              {(total ? data : [{ color: "#e4d8c9" }]).map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-label">
          <strong>{total}</strong>
          <span>total copies</span>
        </div>
      </div>
      <div className="donut-legend">
        {data.map((d) => (
          <div key={d.name}>
            <span>
              <i style={{ background: d.color }} />
              {d.name}
            </span>
            <strong>{d.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
