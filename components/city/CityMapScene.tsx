"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  createDistrictFeatureCollection,
  createStartupFeatureCollection,
  founderGeoPosition,
} from "@/lib/map/scene";
import type { CityState } from "@/lib/types/city";
import { cn } from "@/lib/utils";

type CityMapSceneProps = {
  state: CityState;
  selectedFounderId?: string | null;
  onSelectFounder?: (founderId: string) => void;
  compact?: boolean;
};

type MapboxSourceLike = {
  setData: (data: unknown) => void;
};

type MapboxMapLike = {
  on: (event: string, handler: () => void) => void;
  off: (event: string, handler: () => void) => void;
  addSource: (id: string, source: unknown) => void;
  getSource: (id: string) => MapboxSourceLike | undefined;
  addLayer: (layer: unknown, beforeId?: string) => void;
  getLayer: (id: string) => unknown;
  getStyle: () => { layers?: Array<{ id: string; type?: string }> };
  project: (lngLat: [number, number]) => { x: number; y: number };
  addControl: (control: unknown, position?: string) => void;
  setLayoutProperty: (layerId: string, name: string, value: unknown) => void;
  resize: () => void;
  remove: () => void;
};

const DISTRICT_SOURCE_ID = "founder-city-districts";
const STARTUP_SOURCE_ID = "founder-city-startups";
const DISTRICT_LAYER_ID = "founder-city-district-layer";
const STARTUP_LAYER_ID = "founder-city-startup-layer";
const TOWER_ANIMATION_MS = 900;
const SAN_FRANCISCO_BOUNDS = [
  [-122.525, 37.703],
  [-122.355, 37.833],
] as [[number, number], [number, number]];

function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - progress, 3);
}

function interpolateCollections(
  from: ReturnType<typeof createDistrictFeatureCollection>,
  to: ReturnType<typeof createDistrictFeatureCollection>,
  progress: number,
) {
  const previousById = new Map(from.features.map((feature) => [feature.properties.id, feature]));

  return {
    ...to,
    features: to.features.map((feature) => {
      const previous = previousById.get(feature.properties.id);
      if (!previous) {
        return feature;
      }

      return {
        ...feature,
        properties: {
          ...feature.properties,
          height:
            previous.properties.height +
            (feature.properties.height - previous.properties.height) * progress,
          base:
            previous.properties.base +
            (feature.properties.base - previous.properties.base) * progress,
        },
      };
    }),
  };
}

function MissingTokenPanel({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex h-full min-h-[360px] flex-col justify-between rounded-[32px] border border-white/10 bg-slate-950/82 p-5 text-slate-100",
        compact && "min-h-[240px] p-4",
      )}
    >
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-cyan-300/80">
          Map Unavailable
        </p>
        <h3 className="mt-3 max-w-md text-2xl font-semibold tracking-tight text-white">
          Add `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` to enable the live SF skyline.
        </h3>
      </div>
      <div className="rounded-3xl border border-white/8 bg-white/4 p-4 text-sm text-slate-300">
        The simulation still runs without the map, but the demo scene needs the Mapbox public token.
      </div>
    </div>
  );
}

function StartupBadge({
  left,
  top,
  glow,
  logoDataUrl,
  monogram,
  brandColor,
  compact,
  elevated,
}: {
  left: number;
  top: number;
  glow: string;
  logoDataUrl: string | null;
  monogram: string;
  brandColor: string;
  compact: boolean;
  elevated: boolean;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute -translate-x-1/2 -translate-y-full transition-transform duration-700",
        elevated ? "animate-[city-bob_4.2s_ease-in-out_infinite]" : "animate-[city-bob_5.1s_ease-in-out_infinite]",
      )}
      style={{ left, top }}
    >
      <div
        className={cn(
          "rounded-full border border-white/14 bg-slate-950/88 p-1.5 shadow-[0_0_42px_rgba(15,23,42,0.55)] backdrop-blur",
          compact ? "h-8 w-8" : "h-10 w-10",
        )}
        style={{ boxShadow: `0 0 28px ${glow}` }}
      >
        <div
          className="flex h-full w-full items-center justify-center overflow-hidden rounded-full ring-1 ring-white/12"
          style={{ background: `radial-gradient(circle at 30% 20%, ${brandColor}, #020617 72%)` }}
        >
          {logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoDataUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{monogram}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function CityMapScene({
  state,
  selectedFounderId,
  onSelectFounder,
  compact = false,
}: CityMapSceneProps) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMapLike | null>(null);
  const initializingRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [projectionVersion, setProjectionVersion] = useState(0);

  const districtFeatures = useMemo(() => createDistrictFeatureCollection(state), [state]);
  const startupFeatures = useMemo(() => createStartupFeatureCollection(state), [state]);
  const [animatedDistrictFeatures, setAnimatedDistrictFeatures] = useState(districtFeatures);
  const [animatedStartupFeatures, setAnimatedStartupFeatures] = useState(startupFeatures);
  const animatedDistrictFeaturesRef = useRef(animatedDistrictFeatures);
  const animatedStartupFeaturesRef = useRef(animatedStartupFeatures);

  animatedDistrictFeaturesRef.current = animatedDistrictFeatures;
  animatedStartupFeaturesRef.current = animatedStartupFeatures;

  useEffect(() => {
    const animationStart = performance.now();
    const previousDistrictFeatures = animatedDistrictFeaturesRef.current;
    const previousStartupFeatures = animatedStartupFeaturesRef.current;
    let frameId = 0;

    const animate = (timestamp: number) => {
      const elapsed = timestamp - animationStart;
      const progress = easeOutCubic(Math.min(1, elapsed / TOWER_ANIMATION_MS));

      setAnimatedDistrictFeatures(
        interpolateCollections(previousDistrictFeatures, districtFeatures, progress),
      );
      setAnimatedStartupFeatures(
        interpolateCollections(previousStartupFeatures, startupFeatures, progress),
      );

      if (progress < 1) {
        frameId = window.requestAnimationFrame(animate);
      }
    };

    frameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [districtFeatures, startupFeatures]);

  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current || initializingRef.current) {
      return;
    }

    let map: MapboxMapLike | null = null;
    let disposed = false;
    const container = containerRef.current;
    initializingRef.current = true;
    const mapHost = document.createElement("div");
    mapHost.className = "absolute inset-0";
    container.replaceChildren(mapHost);

    void (async () => {
      const mapboxglModule = await import("mapbox-gl");
      const mapboxgl = mapboxglModule.default;
      mapboxgl.accessToken = token;

      map = new mapboxgl.Map({
        container: mapHost,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [state.mapCamera.longitude, state.mapCamera.latitude],
        zoom: state.mapCamera.zoom,
        pitch: state.mapCamera.pitch,
        bearing: state.mapCamera.bearing,
        antialias: true,
        interactive: true,
        maxBounds: SAN_FRANCISCO_BOUNDS,
      }) as unknown as MapboxMapLike;

      mapRef.current = map;
      map.addControl(
        new mapboxgl.NavigationControl({
          showCompass: true,
          showZoom: true,
          visualizePitch: true,
        }),
        "top-right",
      );

      const syncProjection = () => setProjectionVersion((current) => current + 1);

      map.on("load", () => {
        if (disposed || !map) {
          return;
        }

        const labelLayerId = map.getStyle().layers?.find((layer) => layer.type === "symbol")?.id;
        for (const layer of map.getStyle().layers ?? []) {
          if (layer.type === "symbol") {
            map.setLayoutProperty(layer.id, "visibility", "none");
          }
        }

        if (!map.getLayer("3d-buildings")) {
          map.addLayer(
            {
              id: "3d-buildings",
              source: "composite",
              "source-layer": "building",
              filter: ["==", "extrude", "true"],
              type: "fill-extrusion",
              minzoom: 12,
              paint: {
                "fill-extrusion-color": "#0f172a",
                "fill-extrusion-height": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  12,
                  0,
                  13.2,
                  ["get", "height"],
                ],
                "fill-extrusion-base": ["get", "min_height"],
                "fill-extrusion-opacity": 0.22,
              },
            },
            labelLayerId,
          );
        }

        map.addSource(DISTRICT_SOURCE_ID, {
          type: "geojson",
          data: animatedDistrictFeaturesRef.current,
        });
        map.addSource(STARTUP_SOURCE_ID, {
          type: "geojson",
          data: animatedStartupFeaturesRef.current,
        });

        map.addLayer(
          {
            id: DISTRICT_LAYER_ID,
            type: "fill-extrusion",
            source: DISTRICT_SOURCE_ID,
            paint: {
              "fill-extrusion-color": ["get", "color"],
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "base"],
              "fill-extrusion-opacity": 0.68,
            },
          },
          labelLayerId,
        );

        map.addLayer(
          {
            id: STARTUP_LAYER_ID,
            type: "fill-extrusion",
            source: STARTUP_SOURCE_ID,
            paint: {
              "fill-extrusion-color": ["get", "color"],
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "base"],
              "fill-extrusion-opacity": 0.96,
            },
          },
          labelLayerId,
        );

        map.on("move", syncProjection);
        map.on("zoom", syncProjection);
        map.on("rotate", syncProjection);
        map.on("pitch", syncProjection);
        map.on("resize", syncProjection);

        setMapReady(true);
        syncProjection();
      });
    })().finally(() => {
      initializingRef.current = false;
    });

    return () => {
      disposed = true;
      setMapReady(false);
      initializingRef.current = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      container.replaceChildren();
    };
  }, [state.mapCamera.bearing, state.mapCamera.latitude, state.mapCamera.longitude, state.mapCamera.pitch, state.mapCamera.zoom, token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) {
      return;
    }

    map.getSource(DISTRICT_SOURCE_ID)?.setData(animatedDistrictFeatures);
    map.getSource(STARTUP_SOURCE_ID)?.setData(animatedStartupFeatures);
    map.resize();
  }, [animatedDistrictFeatures, animatedStartupFeatures, mapReady]);

  if (!token) {
    return <MissingTokenPanel compact={compact} />;
  }

  const projectedStartups =
    mapReady && mapRef.current
      ? state.playerStartups
          .map((startup) => {
            const parcel = state.startupParcels.find((entry) => entry.id === startup.parcelId);
            if (!parcel) {
              return null;
            }

            const projected = mapRef.current!.project([parcel.center.lng, parcel.center.lat]);
            return { startup, projected };
          })
          .filter(Boolean)
          .sort((left, right) => (right?.startup.buildingHeight ?? 0) - (left?.startup.buildingHeight ?? 0))
      : [];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/88 shadow-[0_38px_120px_rgba(2,6,23,0.72)]",
        compact ? "h-[340px]" : "h-[700px]",
      )}
    >
      <div ref={containerRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.16),transparent_24%),radial-gradient(circle_at_80%_0%,rgba(249,115,22,0.16),transparent_26%),linear-gradient(180deg,rgba(2,6,23,0.06),rgba(2,6,23,0.3))]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-950 via-slate-950/65 to-transparent" />

      {mapReady && mapRef.current ? (
        <div className="pointer-events-none absolute inset-0" key={projectionVersion}>
          {projectedStartups.map((entry) => {
            if (!entry) {
              return null;
            }

            return (
              <StartupBadge
                key={entry.startup.id}
                left={entry.projected.x}
                top={entry.projected.y - Math.min(entry.startup.buildingHeight * 0.32, compact ? 80 : 110)}
                glow={`${entry.startup.brandColor}66`}
                logoDataUrl={entry.startup.logoDataUrl}
                monogram={entry.startup.logoMonogram}
                brandColor={entry.startup.brandColor}
                compact={compact}
                elevated={entry.startup.controlMode === "player"}
              />
            );
          })}

          {state.founders.map((founder) => {
            const point = founderGeoPosition(state, founder);
            const projected = mapRef.current!.project([point.lng, point.lat]);
            const selected = founder.id === selectedFounderId;

            return (
              <button
                key={founder.id}
                type="button"
                onClick={() => onSelectFounder?.(founder.id)}
                className={cn(
                  "pointer-events-auto absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border transition",
                  selected
                    ? "border-cyan-100 bg-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.85)]"
                    : "border-white/30 bg-slate-950/85 shadow-[0_0_16px_rgba(255,255,255,0.18)] hover:border-cyan-200/70 hover:bg-cyan-200/70",
                )}
                style={{ left: projected.x, top: projected.y }}
                aria-label={founder.name}
              />
            );
          })}
        </div>
      ) : null}

      <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/68 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.32em] text-cyan-300/82 backdrop-blur">
        <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.8)]" />
        Live SF
      </div>

      {!compact ? (
        <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/66 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.26em] text-white/72 backdrop-blur">
          Move, zoom, and rotate the city
        </div>
      ) : null}
    </div>
  );
}
