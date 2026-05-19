'use client';

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

interface Props {
  data: Array<{ label: string; value: number; color: string }>;
  height?: number;
}

export function DonutChart({ data, height = 280 }: Props) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <PieChart>
          <Tooltip
            contentStyle={{
              background: '#ffffff',
              border: '1px solid #c4c4c4',
              color: '#0f383c',
              boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
            }}
          />
          <Legend wrapperStyle={{ color: '#0f383c', fontSize: 12 }} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            isAnimationActive={false}
          >
            {data.map((d) => (
              <Cell key={d.label} fill={d.color} stroke="#ffffff" />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
