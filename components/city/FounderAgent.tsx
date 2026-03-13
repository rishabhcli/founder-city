import { FounderAgentState } from "@/lib/types/city";

type FounderAgentProps = {
  founder: FounderAgentState;
  districtPosition: { x: number; y: number };
  onSelect: () => void;
};

export function FounderAgent({ founder, districtPosition, onSelect }: FounderAgentProps) {
  const size = 11;
  const progressOffset = founder.routeProgress * 22;
  const x = districtPosition.x + progressOffset;
  const y = districtPosition.y + 16;

  return (
    <g onClick={onSelect} className="cursor-pointer">
      <circle cx={x} cy={y} r={size} fill={founder.avatarHue} stroke="#f8fafc" strokeWidth={1.5} />
      <text x={x} y={y - 14} textAnchor="middle" fill="#f8fafc" className="text-[10px]">
        {founder.name}
      </text>
      {founder.status !== "dead" ? (
        <text x={x} y={y + 20} textAnchor="middle" fill="#cbd5e1" className="text-[8px]">
          {founder.status}
        </text>
      ) : null}
    </g>
  );
}

