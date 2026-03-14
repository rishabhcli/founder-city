import type {
  CityState,
  DistrictId,
  FounderAgentState,
  GeoPoint,
  PlayerStartupState,
  StartupParcelState,
} from "@/lib/types/city";

type PolygonFeatureProperties = {
  id: string;
  districtId: DistrictId;
  color: string;
  height: number;
  base: number;
  label: string;
  opacity?: number;
};

type PolygonFeature = {
  type: "Feature";
  properties: PolygonFeatureProperties;
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
};

export type MapFeatureCollection = {
  type: "FeatureCollection";
  features: PolygonFeature[];
};

function toPolygonFeature(
  parcel: StartupParcelState,
  properties: Omit<PolygonFeatureProperties, "id" | "districtId" | "label">,
): PolygonFeature {
  return {
    type: "Feature",
    properties: {
      id: parcel.id,
      districtId: parcel.districtId,
      label: parcel.label,
      ...properties,
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        parcel.footprint.map((point) => [point.lng, point.lat]),
      ],
    },
  };
}

function districtTowerColor(state: CityState, districtId: DistrictId) {
  const district = state.districts[districtId];
  if (district.stats.compute > 80) {
    return "#34d3ff";
  }
  if (district.stats.vibe > 72) {
    return "#ff9c5f";
  }
  if (district.stats.capital > 82) {
    return "#facc15";
  }
  return district.color;
}

function districtTowerHeight(state: CityState, districtId: DistrictId) {
  const district = state.districts[districtId];
  return Math.round(
    320 +
      district.stats.capital * 2.6 +
      district.stats.compute * 2.1 +
      district.stats.vibe * 0.92 -
      district.stats.congestion * 0.28,
  );
}

export function createDistrictFeatureCollection(state: CityState): MapFeatureCollection {
  return {
    type: "FeatureCollection",
    features: state.startupParcels
      .filter((parcel) => parcel.kind === "district")
      .map((parcel) =>
        toPolygonFeature(parcel, {
          color: districtTowerColor(state, parcel.districtId),
          height: districtTowerHeight(state, parcel.districtId) + parcel.lane * 18,
          base: 0,
          opacity: 0.82,
        }),
      ),
  };
}

function startupColor(startup: PlayerStartupState) {
  if (startup.brandColor) {
    return startup.brandColor;
  }

  switch (startup.status) {
    case "breakout":
      return "#f97316";
    case "distressed":
      return "#fb7185";
    case "dead":
      return "#64748b";
    case "growing":
      return "#22c55e";
    case "launching":
      return "#60a5fa";
    case "steady":
    default:
      return "#eab308";
  }
}

export function createStartupFeatureCollection(state: CityState): MapFeatureCollection {
  return {
    type: "FeatureCollection",
    features: state.playerStartups.flatMap((startup) => {
      const parcel = state.startupParcels.find((entry) => entry.id === startup.parcelId);
      if (!parcel) {
        return [];
      }

      return [
        toPolygonFeature(parcel, {
          color: startupColor(startup),
          height: startup.buildingHeight,
          base: 0,
          opacity: 0.96,
        }),
      ];
    }),
  };
}

function interpolatePoint(from: GeoPoint, to: GeoPoint, progress: number) {
  const clamped = Math.max(0, Math.min(1, progress));
  return {
    lng: from.lng + (to.lng - from.lng) * clamped,
    lat: from.lat + (to.lat - from.lat) * clamped,
  };
}

export function founderGeoPosition(state: CityState, founder: FounderAgentState): GeoPoint {
  const current = state.districts[founder.currentDistrict].geo;
  const nextDistrictId =
    founder.route[founder.routeIndex + 1] ??
    founder.targetDistrict ??
    founder.currentDistrict;
  const target = state.districts[nextDistrictId].geo;

  if (founder.currentDistrict === nextDistrictId) {
    return current;
  }

  return interpolatePoint(current, target, founder.routeProgress);
}
