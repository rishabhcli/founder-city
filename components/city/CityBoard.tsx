import { CityState } from "@/lib/types/city";
import { RouteEdge } from "@/components/city/RouteEdge";
import { DistrictNode } from "@/components/city/DistrictNode";
import { FounderAgent } from "@/components/city/FounderAgent";

type CityBoardProps = {
  state: CityState;
  selectedFounderId?: string | null;
  onSelectFounder?: (founderId: string) => void;
  compact?: boolean;
};

export function CityBoard({
  state,
  selectedFounderId,
  onSelectFounder,
  compact = false,
}: CityBoardProps) {
  const districtById = state.districts;
  const highlightedDistrict = selectedFounderId
    ? state.founders.find((founder) => founder.id === selectedFounderId)?.currentDistrict
    : null;

  return (
    <svg
      viewBox="0 0 640 420"
      className={`w-full rounded-xl border border-zinc-700/70 bg-zinc-900/70 p-2 ${compact ? "h-[260px]" : "h-[420px]"}`}
    >
      {state.edges.map((edge) => {
        const from = districtById[edge.from];
        const to = districtById[edge.to];
        return <RouteEdge key={edge.id} edge={edge} fromPosition={from.position} toPosition={to.position} />;
      })}
      {Object.values(districtById).map((district) => (
        <DistrictNode
          key={district.id}
          district={district}
          selected={district.id === highlightedDistrict}
          onSelect={() => {
            // Reserved for future district-level control actions.
          }}
        />
      ))}
      {state.founders.map((founder) => (
        <FounderAgent
          key={founder.id}
          founder={founder}
          districtPosition={districtById[founder.currentDistrict].position}
          onSelect={() => onSelectFounder?.(founder.id)}
        />
      ))}
      {selectedFounderId ? (
        <text x={14} y={26} fill="#bae6fd" className="text-xs">
          Selected founder: {selectedFounderId}
        </text>
      ) : null}
    </svg>
  );
}
