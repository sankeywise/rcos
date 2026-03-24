type Props = {
  percentage: number;
};

export default function ReadinessCircle({ percentage }: Props) {
  const radius = 40;
  const stroke = 8;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;

  const strokeDashoffset =
    circumference - (percentage / 100) * circumference;

  return (
    <div className="flex items-center justify-center">
      <svg height={radius * 2} width={radius * 2}>
        <circle
          stroke="#e2e8f0"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />

        <circle
          stroke="#2563eb"
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={circumference + " " + circumference}
          style={{ strokeDashoffset }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          className="transition-all duration-700"
        />

        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dy=".3em"
          className="text-lg font-bold fill-slate-800"
        >
          {percentage}%
        </text>
      </svg>
    </div>
  );
}