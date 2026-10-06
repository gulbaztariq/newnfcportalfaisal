import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';

export const CHART_COLORS = ['var(--primary)', 'oklch(0.66 0.24 330)', 'oklch(0.72 0.17 160)', 'oklch(0.78 0.16 70)', 'oklch(0.65 0.16 240)', 'oklch(0.62 0.22 25)'];

function ChartTip({ active, payload, label, format }) {
  if (!active || !payload?.length) return null;
  const f = format || ((v) => v);
  return (
    <div className="rounded-xl border border-border bg-card/95 px-3 py-2 text-xs shadow-lift backdrop-blur">
      {label && <p className="mb-1 font-medium text-muted-foreground">{label}</p>}
      {payload.map((p) => (
        <p key={p.dataKey || p.name} className="font-semibold">
          <span className="mr-1.5 inline-block size-2 rounded-full" style={{ background: p.color || p.payload?.fill }} />{p.name}: {f(p.value)}
        </p>
      ))}
    </div>
  );
}

export function AreaTrend({ data, dataKey = 'value', name = 'Value', height = 300, format }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id={`g-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} minTickGap={16} />
        <YAxis tickLine={false} axisLine={false} tickFormatter={format} width={56} allowDecimals={false} />
        <Tooltip content={<ChartTip format={format} />} />
        <Area type="monotone" dataKey={dataKey} name={name} stroke="var(--primary)" strokeWidth={2.5} fill={`url(#g-${dataKey})`} animationDuration={1200} activeDot={{ r: 5, strokeWidth: 3, stroke: 'var(--card)' }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function Bars({ data, dataKey = 'value', name = 'Value', height = 300 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="bar-g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="oklch(0.66 0.24 330)" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} minTickGap={12} />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip content={<ChartTip />} />
        <Bar dataKey={dataKey} name={name} fill="url(#bar-g)" radius={[6, 6, 2, 2]} maxBarSize={28} animationDuration={1000} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Donut({ data, height = 240, center }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="relative">
      <div className="relative">
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Tooltip content={<ChartTip />} />
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="92%" paddingAngle={3} cornerRadius={6} stroke="none" animationDuration={1100}>
              {data.map((d, i) => <Cell key={d.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div><p className="font-display text-3xl font-bold">{total}</p><p className="text-xs text-muted-foreground">{center}</p></div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2">
        {data.map((d, i) => (
          <span key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />{d.name} <b className="text-foreground">{d.value}</b>
          </span>
        ))}
      </div>
    </div>
  );
}
