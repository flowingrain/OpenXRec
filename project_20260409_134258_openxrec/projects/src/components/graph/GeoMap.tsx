'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Layers,
  MapPin,
  Route,
  Flame,
  Globe,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Loader2
} from 'lucide-react';

// 修复 Leaflet 默认图标问题
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon.src,
  iconRetinaUrl: markerIcon2x.src,
  shadowUrl: markerShadow.src,
});

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 地理位置数据
 */
export interface GeoLocation {
  name: string;
  type: 'country' | 'city' | 'region' | 'landmark' | 'water' | 'mountain';
  coordinates: {
    lat: number;
    lng: number;
  };
  significance: string;
  relatedEvents: string[];
  importance: number;
}

/**
 * 地理连接（传导路径）
 */
export interface GeoConnection {
  from: string;
  to: string;
  type: 'trade' | 'conflict' | 'cooperation' | 'flow' | 'risk';
  strength: number;
}

/**
 * 热点区域
 */
export interface GeoHotspot {
  name: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  intensity: number;
  events: string[];
}

/**
 * 地图底图类型
 */
export type BasemapType = 'amap' | 'osm' | 'satellite';

/**
 * 图层类型
 */
export type LayerType = 'markers' | 'heatmap' | 'connections';

/**
 * GeoMap 组件属性
 */
export interface GeoMapProps {
  locations?: GeoLocation[];
  connections?: GeoConnection[];
  hotspots?: GeoHotspot[];
  geoSummary?: string;
  className?: string;
}

// ============================================================================
// 底图配置
// ============================================================================

// 高德地图 Key
const AMAP_KEY = 'db3ba634f2c99ef1d5ab5cd79df1a461';

const BASEMAP_CONFIGS = {
  amap: {
    name: '高德地图',
    url: `https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}`,
    options: {
      subdomains: ['1', '2', '3', '4'],
      maxZoom: 18,
      attribution: '&copy; 高德地图'
    }
  },
  satellite: {
    name: '高德卫星',
    url: `https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}`,
    options: {
      subdomains: ['1', '2', '3', '4'],
      maxZoom: 18,
      attribution: '&copy; 高德地图'
    }
  },
  osm: {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      subdomains: ['a', 'b', 'c'],
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }
  }
};

// ============================================================================
// 自定义图标
// ============================================================================

const createCustomIcon = (type: string, importance: number) => {
  const colors: Record<string, string> = {
    country: '#ef4444',   // 红色
    city: '#f97316',      // 橙色
    region: '#eab308',    // 黄色
    landmark: '#22c55e',  // 绿色
    water: '#3b82f6',     // 蓝色
    mountain: '#78716c'   // 灰色
  };

  const color = colors[type] || '#6b7280';
  const size = Math.max(24, Math.min(40, 24 + importance * 16));

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: ${size * 0.4}px;
        font-weight: bold;
      ">
        ${type === 'country' ? '国' : type === 'city' ? '市' : type === 'region' ? '区' : type === 'landmark' ? '标' : type === 'water' ? '水' : '山'}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2]
  });
};

const createHotspotIcon = (intensity: number) => {
  const size = 20 + intensity * 30;
  const opacity = 0.3 + intensity * 0.5;

  return L.divIcon({
    className: 'hotspot-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: radial-gradient(circle, rgba(239, 68, 68, ${opacity}) 0%, rgba(239, 68, 68, 0) 70%);
        border-radius: 50%;
        animation: pulse 2s infinite;
      "></div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
};

// ============================================================================
// 地图控制组件
// ============================================================================

function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);

  return null;
}

function MapEvents({ onBoundsChange }: { onBoundsChange: (bounds: L.LatLngBounds) => void }) {
  const map = useMap();
  
  useEffect(() => {
    onBoundsChange(map.getBounds());
  }, [map, onBoundsChange]);

  useMapEvents({
    moveend: () => {
      onBoundsChange(map.getBounds());
    }
  });

  return null;
}

// ============================================================================
// 热力图层组件
// ============================================================================

function HeatmapLayer({ hotspots, visible }: { hotspots: GeoHotspot[]; visible: boolean }) {
  if (!visible || hotspots.length === 0) return null;

  return (
    <>
      {hotspots.map((hotspot, index) => (
        <Marker
          key={`hotspot-${index}`}
          position={[hotspot.coordinates.lat, hotspot.coordinates.lng]}
          icon={createHotspotIcon(hotspot.intensity)}
        >
          <Popup>
            <div className="p-2">
              <h4 className="font-bold text-sm">{hotspot.name}</h4>
              <p className="text-xs text-muted-foreground mt-1">
                热度: {(hotspot.intensity * 100).toFixed(0)}%
              </p>
              {hotspot.events.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium">相关事件:</p>
                  <ul className="text-xs text-muted-foreground mt-1">
                    {hotspot.events.slice(0, 3).map((event, i) => (
                      <li key={i}>• {event}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

// ============================================================================
// 连接线层组件
// ============================================================================

const CONNECTION_COLORS: Record<string, string> = {
  trade: '#22c55e',      // 绿色 - 贸易
  conflict: '#ef4444',   // 红色 - 冲突
  cooperation: '#3b82f6', // 蓝色 - 合作
  flow: '#f97316',       // 橙色 - 流动
  risk: '#eab308'        // 黄色 - 风险
};

function ConnectionsLayer({
  connections,
  locations,
  visible
}: {
  connections: GeoConnection[];
  locations: GeoLocation[];
  visible: boolean
}) {
  const [hoveredConnection, setHoveredConnection] = useState<string | null>(null);

  // 构建位置索引
  const locationMap = useMemo(() => {
    const map = new Map<string, GeoLocation>();
    locations.forEach(loc => map.set(loc.name, loc));
    return map;
  }, [locations]);

  // 转换连接为路径
  const paths = useMemo(() => {
    return connections
      .map(conn => {
        const fromLoc = locationMap.get(conn.from);
        const toLoc = locationMap.get(conn.to);
        if (!fromLoc || !toLoc) return null;
        
        return {
          id: `${conn.from}-${conn.to}`,
          from: [fromLoc.coordinates.lat, fromLoc.coordinates.lng] as [number, number],
          to: [toLoc.coordinates.lat, toLoc.coordinates.lng] as [number, number],
          type: conn.type,
          strength: conn.strength,
          fromName: conn.from,
          toName: conn.to
        };
      })
      .filter(Boolean) as Array<{
        id: string;
        from: [number, number];
        to: [number, number];
        type: string;
        strength: number;
        fromName: string;
        toName: string;
      }>;
  }, [connections, locationMap]);

  if (!visible || paths.length === 0) return null;

  return (
    <>
      {paths.map((path) => {
        const isHovered = hoveredConnection === path.id;
        const color = CONNECTION_COLORS[path.type] || '#6b7280';
        
        return (
          <Polyline
            key={path.id}
            positions={[path.from, path.to]}
            pathOptions={{
              color,
              weight: 2 + path.strength * 4,
              opacity: isHovered ? 1 : 0.6,
              dashArray: path.type === 'flow' ? '5, 10' : undefined
            }}
            eventHandlers={{
              mouseover: () => setHoveredConnection(path.id),
              mouseout: () => setHoveredConnection(null)
            }}
          >
            <Popup>
              <div className="p-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ background: color }}
                  />
                  <span className="font-bold text-sm">
                    {path.fromName} → {path.toName}
                  </span>
                </div>
                <div className="mt-2 space-y-1 text-xs">
                  <p>类型: <Badge variant="outline">{path.type}</Badge></p>
                  <p>强度: {(path.strength * 100).toFixed(0)}%</p>
                </div>
              </div>
            </Popup>
          </Polyline>
        );
      })}
    </>
  );
}

// ============================================================================
// 主组件
// ============================================================================

export function GeoMap({
  locations = [],
  connections = [],
  hotspots = [],
  geoSummary,
  className = ''
}: GeoMapProps) {
  const [basemap, setBasemap] = useState<BasemapType>('amap');
  const [activeLayers, setActiveLayers] = useState<LayerType[]>(['markers', 'connections']);
  const [selectedLocation, setSelectedLocation] = useState<GeoLocation | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([35.8617, 104.1954]); // 中国中心
  const [mapZoom, setMapZoom] = useState(4);

  // 根据位置计算地图边界
  useEffect(() => {
    if (locations.length > 0) {
      const validLocations = locations.filter(
        loc => loc.coordinates.lat && loc.coordinates.lng
      );
      
      if (validLocations.length > 0) {
        const lats = validLocations.map(l => l.coordinates.lat);
        const lngs = validLocations.map(l => l.coordinates.lng);
        
        const centerLat = (Math.max(...lats) + Math.min(...lats)) / 2;
        const centerLng = (Math.max(...lngs) + Math.min(...lngs)) / 2;
        
        setMapCenter([centerLat, centerLng]);
        
        // 计算合适的缩放级别
        const latDiff = Math.max(...lats) - Math.min(...lats);
        const lngDiff = Math.max(...lngs) - Math.min(...lngs);
        const maxDiff = Math.max(latDiff, lngDiff);
        
        if (maxDiff > 50) setMapZoom(2);
        else if (maxDiff > 20) setMapZoom(3);
        else if (maxDiff > 10) setMapZoom(4);
        else if (maxDiff > 5) setMapZoom(5);
        else setMapZoom(6);
      }
    }
  }, [locations]);

  // 按类型分组位置
  const locationsByType = useMemo(() => {
    const grouped: Record<string, GeoLocation[]> = {};
    locations.forEach(loc => {
      if (!grouped[loc.type]) grouped[loc.type] = [];
      grouped[loc.type].push(loc);
    });
    return grouped;
  }, [locations]);

  const basemapConfig = BASEMAP_CONFIGS[basemap];

  return (
    <Card className={`shadow-lg ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              地理态势图谱
            </CardTitle>
            <CardDescription>
              {geoSummary || '地理分布与传导路径可视化'}
            </CardDescription>
          </div>
          
          {/* 底图选择器 */}
          <Select
            value={basemap}
            onValueChange={(value) => setBasemap(value as BasemapType)}
          >
            <SelectTrigger className="w-[140px]">
              <Layers className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="amap">高德地图</SelectItem>
              <SelectItem value="satellite">高德卫星</SelectItem>
              <SelectItem value="osm">OpenStreetMap</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 图层控制 */}
        <div className="flex items-center gap-4 mt-3">
          <ToggleGroup
            type="multiple"
            value={activeLayers}
            onValueChange={(value) => setActiveLayers(value as LayerType[])}
            className="justify-start"
          >
            <ToggleGroupItem value="markers" aria-label="显示标记">
              <MapPin className="w-4 h-4 mr-1" />
              位置标记
            </ToggleGroupItem>
            <ToggleGroupItem value="heatmap" aria-label="显示热力图">
              <Flame className="w-4 h-4 mr-1" />
              热力图
            </ToggleGroupItem>
            <ToggleGroupItem value="connections" aria-label="显示连接">
              <Route className="w-4 h-4 mr-1" />
              传导路径
            </ToggleGroupItem>
          </ToggleGroup>

          {/* 统计信息 */}
          <div className="flex items-center gap-2 ml-auto text-sm text-muted-foreground">
            <Badge variant="secondary">{locations.length} 个位置</Badge>
            <Badge variant="secondary">{connections.length} 条路径</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="relative h-[500px] w-full">
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            className="h-full w-full z-0"
            zoomControl={false}
          >
            <MapController center={mapCenter} zoom={mapZoom} />
            
            {/* 底图 */}
            <TileLayer
              url={basemapConfig.url}
              {...basemapConfig.options}
            />

            {/* 热力图层 */}
            <HeatmapLayer
              hotspots={hotspots}
              visible={activeLayers.includes('heatmap')}
            />

            {/* 位置标记层 */}
            {activeLayers.includes('markers') && locations.map((location, index) => (
              <Marker
                key={`loc-${index}`}
                position={[location.coordinates.lat, location.coordinates.lng]}
                icon={createCustomIcon(location.type, location.importance)}
                eventHandlers={{
                  click: () => setSelectedLocation(location)
                }}
              >
                <Popup>
                  <div className="p-2 min-w-[200px]">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">{location.type}</Badge>
                      <span className="font-bold">{location.name}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {location.significance}
                    </p>
                    {location.relatedEvents.length > 0 && (
                      <div className="border-t pt-2 mt-2">
                        <p className="text-xs font-medium mb-1">相关事件:</p>
                        <ul className="text-xs text-muted-foreground space-y-1">
                          {location.relatedEvents.slice(0, 3).map((event, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <span className="text-primary">•</span>
                              {event}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-2">
                      重要度: {(location.importance * 100).toFixed(0)}%
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* 连接线层 */}
            <ConnectionsLayer
              connections={connections}
              locations={locations}
              visible={activeLayers.includes('connections')}
            />
          </MapContainer>

          {/* 图例 */}
          <div className="absolute bottom-4 left-4 bg-background/95 backdrop-blur p-3 rounded-lg shadow-lg text-xs z-[1000]">
            <p className="font-medium mb-2">位置类型</p>
            <div className="grid grid-cols-2 gap-1">
              {Object.entries({
                country: '国家',
                city: '城市',
                region: '区域',
                landmark: '地标',
                water: '水域',
                mountain: '山脉'
              }).map(([type, label]) => (
                <div key={type} className="flex items-center gap-1">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ background: type === 'country' ? '#ef4444' : type === 'city' ? '#f97316' : type === 'region' ? '#eab308' : type === 'landmark' ? '#22c55e' : type === 'water' ? '#3b82f6' : '#78716c' }}
                  />
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <p className="font-medium mt-3 mb-2">传导类型</p>
            <div className="space-y-1">
              {Object.entries({
                trade: '贸易',
                conflict: '冲突',
                cooperation: '合作',
                flow: '流动',
                risk: '风险'
              }).map(([type, label]) => (
                <div key={type} className="flex items-center gap-1">
                  <div
                    className="w-4 h-0.5"
                    style={{ background: CONNECTION_COLORS[type] }}
                  />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 缩放控制 */}
          <div className="absolute top-4 right-4 flex flex-col gap-2 z-[1000]">
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8"
              onClick={() => setMapZoom(z => Math.min(18, z + 1))}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8"
              onClick={() => setMapZoom(z => Math.max(2, z - 1))}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8"
              onClick={() => {
                if (locations.length > 0) {
                  setMapCenter([35.8617, 104.1954]);
                  setMapZoom(4);
                }
              }}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default GeoMap;
