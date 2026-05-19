'use client';

import {
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface Props {
  data: Array<{ label: string; value: number }>;
  height?: number;
  fill?: string;
}

export function BarChart({ data, height = 280, fill = '#00b2c7' }: Props) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <RBarChart data={data} margin={{ top: 12, right: 12, bottom: 12, left: 12 }}>
          <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" stroke="#6b7280" tick={{ fontSize: 12 }} />
          <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              background: '#ffffff',
              border: '1px solid #c4c4c4',
              color: '#0f383c',
              boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
            }}
            cursor={{ fill: '#f4f6f7' }}
          />
          <Bar dataKey="value" fill={fill} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </RBarChart>
      </ResponsiveContainer>
    </div>
  );
}
