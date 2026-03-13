import { DistrictState } from "@/lib/types/city";

type DistrictNodeProps = {
  district: DistrictState;
  onSelect?: () => void;
  selected: boolean;
};

export function DistrictNode({ district, onSelect, selected }: DistrictNodeProps) {
  return (
    <g onClick={onSelect}>
      <circle
        cx={district.position.x}
        cy={district.position.y}
        r={38}
        fill={district.color}
        stroke={selected ? "#f5d142" : "#18181b"}
        strokeWidth={selected ? 3 : 2}
        opacity={0.95}
      />
      <circle
        cx={district.position.x}
        cy={district.position.y}
        r={56}
        fill="none"
        stroke={district.halo}
        strokeWidth={1.5}
        opacity={0.8}
      />
      <text x={district.position.x} y={district.position.y - 42} textAnchor="middle" fill="#f8fafc" className="text-[14px]">
        {district.label}
      </text>
      <text x={district.position.x} y={district.position.y - 28} textAnchor="middle" fill="#d4d4d8" className="text-xs">
        V {Math.round(district.stats.vibe)} | B {Math.round(district.stats.localBusiness)}
      </text>
    </g>
  );
}

