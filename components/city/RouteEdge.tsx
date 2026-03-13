import { CityEdge } from "@/lib/types/city";

type RouteEdgeProps = {
  edge: CityEdge;
  fromPosition: { x: number; y: number };
  toPosition: { x: number; y: number };
};

export function RouteEdge({ edge, fromPosition, toPosition }: RouteEdgeProps) {
  return (
    <line
      x1={fromPosition.x}
      y1={fromPosition.y}
      x2={toPosition.x}
      y2={toPosition.y}
      stroke={edge.lineColor}
      strokeWidth={2}
      strokeDasharray={edge.id.includes("connector") ? "4 6" : ""}
      opacity={0.85}
    />
  );
}

