/**
 * 地理地图工具
 * 
 * 提供地理位置查询、坐标解析、路径规划、区域分析等功能
 */

import type { ToolDefinition, ToolCallRequest, ToolCallResult, ToolExecutor } from './types';
import { createSuccessResult, createErrorResult } from './registry';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// ============================================================================
// 常用城市坐标数据
// ============================================================================

const CITY_COORDINATES: Record<string, { lat: number; lng: number; country: string }> = {
  // 中国城市
  '北京': { lat: 39.9042, lng: 116.4074, country: '中国' },
  '上海': { lat: 31.2304, lng: 121.4737, country: '中国' },
  '广州': { lat: 23.1291, lng: 113.2644, country: '中国' },
  '深圳': { lat: 22.5431, lng: 114.0579, country: '中国' },
  '杭州': { lat: 30.2741, lng: 120.1551, country: '中国' },
  '成都': { lat: 30.5728, lng: 104.0668, country: '中国' },
  '武汉': { lat: 30.5928, lng: 114.3055, country: '中国' },
  '西安': { lat: 34.3416, lng: 108.9398, country: '中国' },
  '南京': { lat: 32.0603, lng: 118.7969, country: '中国' },
  '重庆': { lat: 29.4316, lng: 106.9123, country: '中国' },
  '天津': { lat: 39.0842, lng: 117.2009, country: '中国' },
  '苏州': { lat: 31.2990, lng: 120.5853, country: '中国' },
  '香港': { lat: 22.3193, lng: 114.1694, country: '中国' },
  '台北': { lat: 25.0330, lng: 121.5654, country: '中国' },
  '澳门': { lat: 22.1987, lng: 113.5439, country: '中国' },
  
  // 国际城市
  '纽约': { lat: 40.7128, lng: -74.0060, country: '美国' },
  '伦敦': { lat: 51.5074, lng: -0.1278, country: '英国' },
  '东京': { lat: 35.6762, lng: 139.6503, country: '日本' },
  '巴黎': { lat: 48.8566, lng: 2.3522, country: '法国' },
  '新加坡': { lat: 1.3521, lng: 103.8198, country: '新加坡' },
  '首尔': { lat: 37.5665, lng: 126.9780, country: '韩国' },
  '悉尼': { lat: -33.8688, lng: 151.2093, country: '澳大利亚' },
  '迪拜': { lat: 25.2048, lng: 55.2708, country: '阿联酋' },
  '旧金山': { lat: 37.7749, lng: -122.4194, country: '美国' },
  '洛杉矶': { lat: 34.0522, lng: -118.2437, country: '美国' },
  '柏林': { lat: 52.5200, lng: 13.4050, country: '德国' },
  '莫斯科': { lat: 55.7558, lng: 37.6173, country: '俄罗斯' },
  '曼谷': { lat: 13.7563, lng: 100.5018, country: '泰国' },
  '吉隆坡': { lat: 3.1390, lng: 101.6869, country: '马来西亚' },
};

// ============================================================================
// 工具定义
// ============================================================================

/**
 * 解析地理位置
 */
const geocodeDefinition: ToolDefinition = {
  name: 'geo_geocode',
  displayName: '解析地理位置',
  description: '将地名转换为地理坐标（经纬度），支持城市、地区、地标等。适用于需要在地图上定位的场景。',
  parameters: {
    location: {
      type: 'string',
      description: '地理位置名称，如城市名、地址、地标等',
    },
    fuzzy: {
      type: 'boolean',
      description: '是否启用模糊匹配',
      default: true,
    },
  },
  required: ['location'],
  category: 'geo',
  examples: [
    {
      scenario: '用户想获取某个城市的坐标',
      parameters: { location: '上海' },
      expectedOutput: '返回上海的经纬度坐标',
    },
  ],
};

/**
 * 批量解析地理位置
 */
const batchGeocodeDefinition: ToolDefinition = {
  name: 'geo_batch_geocode',
  displayName: '批量解析地理位置',
  description: '批量将多个地名转换为地理坐标。',
  parameters: {
    locations: {
      type: 'array',
      description: '地理位置名称列表',
      items: { type: 'string', description: '地理位置名称' },
    },
  },
  required: ['locations'],
  category: 'geo',
  examples: [
    {
      scenario: '用户需要在地图上标记多个城市',
      parameters: { locations: ['北京', '上海', '广州'] },
      expectedOutput: '返回所有城市的坐标信息',
    },
  ],
};

/**
 * 计算两地距离
 */
const calculateDistanceDefinition: ToolDefinition = {
  name: 'geo_calculate_distance',
  displayName: '计算两地距离',
  description: '计算两个地理位置之间的直线距离（公里）。',
  parameters: {
    from: {
      type: 'string',
      description: '起始位置名称',
    },
    to: {
      type: 'string',
      description: '目标位置名称',
    },
  },
  required: ['from', 'to'],
  category: 'geo',
  examples: [
    {
      scenario: '用户想知道两个城市之间的距离',
      parameters: { from: '北京', to: '上海' },
      expectedOutput: '返回北京到上海的距离（公里）',
    },
  ],
};

/**
 * 生成地图可视化数据
 */
const generateMapDefinition: ToolDefinition = {
  name: 'geo_generate_map',
  displayName: '生成地图可视化数据',
  description: '根据位置列表生成地图可视化数据，支持标记点、连接线和热力图。',
  parameters: {
    locations: {
      type: 'array',
      description: '位置数据列表',
      items: {
        type: 'object',
        description: '位置信息对象',
        properties: {
          name: { type: 'string', description: '位置名称' },
          type: { type: 'string', description: '位置类型' },
          significance: { type: 'string', description: '重要性说明' },
        },
      },
    },
    connections: {
      type: 'array',
      description: '位置连接关系',
      items: {
        type: 'object',
        description: '位置连接关系',
        properties: {
          from: { type: 'string', description: '起始位置' },
          to: { type: 'string', description: '目标位置' },
          type: { type: 'string', description: '连接类型' },
        },
      },
    },
    title: {
      type: 'string',
      description: '地图标题',
    },
    centerOn: {
      type: 'string',
      description: '地图中心点位置',
    },
  },
  required: ['locations'],
  category: 'geo',
  examples: [
    {
      scenario: '用户需要在地图上展示多个位置和它们之间的关系',
      parameters: { 
        locations: [
          { name: '北京', type: 'city', significance: '首都' },
          { name: '上海', type: 'city', significance: '经济中心' },
        ],
        connections: [{ from: '北京', to: '上海', type: 'trade' }],
        title: '中国主要城市',
      },
      expectedOutput: '返回可渲染的地图数据',
    },
  ],
};

/**
 * 区域分析
 */
const analyzeRegionDefinition: ToolDefinition = {
  name: 'geo_analyze_region',
  displayName: '区域分析',
  description: '分析指定区域的相关信息，包括周边位置、区域特征等。',
  parameters: {
    region: {
      type: 'string',
      description: '区域名称',
    },
    radius: {
      type: 'number',
      description: '分析半径（公里）',
      default: 100,
    },
  },
  required: ['region'],
  category: 'geo',
  examples: [
    {
      scenario: '用户想了解某个区域的地理特征',
      parameters: { region: '长三角', radius: 200 },
      expectedOutput: '返回长三角地区的主要城市和地理特征',
    },
  ],
};

/**
 * 地理路径规划
 */
const planRouteDefinition: ToolDefinition = {
  name: 'geo_plan_route',
  displayName: '地理路径规划',
  description: '规划多个位置之间的最优访问路径。',
  parameters: {
    waypoints: {
      type: 'array',
      description: '途经点列表（按顺序）',
      items: { type: 'string', description: '地理位置名称' },
    },
    optimize: {
      type: 'boolean',
      description: '是否优化路径顺序',
      default: false,
    },
  },
  required: ['waypoints'],
  category: 'geo',
  examples: [
    {
      scenario: '用户需要规划多个城市的访问路线',
      parameters: { waypoints: ['北京', '上海', '广州', '深圳'] },
      expectedOutput: '返回优化的访问路线和总距离',
    },
  ],
};

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 根据名称查找坐标
 */
function findCoordinates(locationName: string, fuzzy = true): { lat: number; lng: number; name: string; country: string } | null {
  // 精确匹配
  if (CITY_COORDINATES[locationName]) {
    return { ...CITY_COORDINATES[locationName], name: locationName };
  }
  
  // 模糊匹配
  if (fuzzy) {
    for (const [name, coords] of Object.entries(CITY_COORDINATES)) {
      if (name.includes(locationName) || locationName.includes(name)) {
        return { ...coords, name };
      }
    }
  }
  
  return null;
}

/**
 * 计算两点间的球面距离（Haversine公式）
 */
function calculateHaversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // 地球半径（公里）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ============================================================================
// 工具执行器
// ============================================================================

/**
 * 解析地理位置执行器
 */
const geocodeExecutor: ToolExecutor = async (request) => {
  const { location, fuzzy = true } = request.parameters;
  
  try {
    const coords = findCoordinates(location, fuzzy);
    
    if (!coords) {
      return createErrorResult(`找不到位置 "${location}" 的坐标`);
    }
    
    return createSuccessResult(
      {
        query: location,
        result: {
          name: coords.name,
          coordinates: { lat: coords.lat, lng: coords.lng },
          country: coords.country,
        },
      },
      `"${location}" 的坐标: (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`,
      {
        type: 'map',
        data: {
          center: { lat: coords.lat, lng: coords.lng },
          markers: [{
            name: coords.name,
            coordinates: { lat: coords.lat, lng: coords.lng },
            type: 'city',
            significance: coords.country,
            importance: 1,
          }],
        },
      }
    );
  } catch (error) {
    return createErrorResult(`地理解析失败: ${error}`);
  }
};

/**
 * 批量解析地理位置执行器
 */
const batchGeocodeExecutor: ToolExecutor = async (request) => {
  const { locations } = request.parameters;
  
  try {
    const results = locations.map((loc: string) => {
      const coords = findCoordinates(loc, true);
      return {
        query: loc,
        found: !!coords,
        result: coords ? {
          name: coords.name,
          coordinates: { lat: coords.lat, lng: coords.lng },
          country: coords.country,
        } : null,
      };
    });
    
    const found = results.filter((r: { found: boolean }) => r.found);
    const notFound = results.filter((r: { found: boolean }) => !r.found);
    
    return createSuccessResult(
      { total: locations.length, found: found.length, notFound: notFound.length, results },
      `成功解析 ${found.length}/${locations.length} 个位置`,
      {
        type: 'map',
        data: {
          center: found.length > 0 
            ? { 
                lat: found.reduce((s: number, r: { result: { coordinates: { lat: number; lng: number } } | null }) => s + (r.result?.coordinates.lat || 0), 0) / found.length,
                lng: found.reduce((s: number, r: { result: { coordinates: { lat: number; lng: number } } | null }) => s + (r.result?.coordinates.lng || 0), 0) / found.length,
              }
            : { lat: 35, lng: 105 },
          markers: found.map((r: { result: { name: string; coordinates: { lat: number; lng: number }; country: string } | null }) => ({
            name: r.result!.name,
            coordinates: r.result!.coordinates,
            type: 'city',
            significance: r.result!.country,
            importance: 1,
          })),
        },
      }
    );
  } catch (error) {
    return createErrorResult(`批量解析失败: ${error}`);
  }
};

/**
 * 计算距离执行器
 */
const calculateDistanceExecutor: ToolExecutor = async (request) => {
  const { from, to } = request.parameters;
  
  try {
    const fromCoords = findCoordinates(from);
    const toCoords = findCoordinates(to);
    
    if (!fromCoords) {
      return createErrorResult(`找不到位置 "${from}" 的坐标`);
    }
    if (!toCoords) {
      return createErrorResult(`找不到位置 "${to}" 的坐标`);
    }
    
    const distance = calculateHaversineDistance(
      fromCoords.lat, fromCoords.lng,
      toCoords.lat, toCoords.lng
    );
    
    return createSuccessResult(
      {
        from: { name: fromCoords.name, coordinates: fromCoords },
        to: { name: toCoords.name, coordinates: toCoords },
        distance: {
          kilometers: Math.round(distance * 10) / 10,
          miles: Math.round(distance * 0.621371 * 10) / 10,
        },
      },
      `"${fromCoords.name}" 到 "${toCoords.name}" 的直线距离: ${Math.round(distance * 10) / 10} 公里`,
      {
        type: 'map',
        data: {
          center: {
            lat: (fromCoords.lat + toCoords.lat) / 2,
            lng: (fromCoords.lng + toCoords.lng) / 2,
          },
          markers: [
            { name: fromCoords.name, coordinates: { lat: fromCoords.lat, lng: fromCoords.lng }, type: 'city', significance: '起点', importance: 1 },
            { name: toCoords.name, coordinates: { lat: toCoords.lat, lng: toCoords.lng }, type: 'city', significance: '终点', importance: 1 },
          ],
          connections: [{
            from: fromCoords.name,
            to: toCoords.name,
            type: 'route',
            strength: 1,
          }],
        },
      }
    );
  } catch (error) {
    return createErrorResult(`距离计算失败: ${error}`);
  }
};

/**
 * 生成地图可视化数据执行器
 */
const generateMapExecutor: ToolExecutor = async (request) => {
  const { locations, connections = [], title = '地理分布图', centerOn } = request.parameters;
  
  try {
    const markers: any[] = [];
    const failedLocations: string[] = [];
    
    for (const loc of locations) {
      const coords = findCoordinates(loc.name);
      if (coords) {
        markers.push({
          name: coords.name,
          coordinates: { lat: coords.lat, lng: coords.lng },
          type: loc.type || 'city',
          significance: loc.significance || '',
          importance: 1,
        });
      } else {
        failedLocations.push(loc.name);
      }
    }
    
    // 处理连接关系
    const validConnections = connections
      .filter((conn: any) => 
        markers.some(m => m.name === conn.from) && 
        markers.some(m => m.name === conn.to)
      )
      .map((conn: any) => ({
        from: conn.from,
        to: conn.to,
        type: conn.type || 'link',
        strength: 1,
      }));
    
    // 计算中心点
    let center = { lat: 35, lng: 105 };
    if (centerOn) {
      const centerCoords = findCoordinates(centerOn);
      if (centerCoords) {
        center = { lat: centerCoords.lat, lng: centerCoords.lng };
      }
    } else if (markers.length > 0) {
      center = {
        lat: markers.reduce((s, m) => s + m.coordinates.lat, 0) / markers.length,
        lng: markers.reduce((s, m) => s + m.coordinates.lng, 0) / markers.length,
      };
    }
    
    return createSuccessResult(
      {
        title,
        center,
        markers,
        connections: validConnections,
        stats: {
          totalLocations: locations.length,
          foundLocations: markers.length,
          failedLocations: failedLocations.length,
          connections: validConnections.length,
        },
        failed: failedLocations,
      },
      `已生成地图 "${title}"，包含 ${markers.length} 个位置和 ${validConnections.length} 个连接`,
      {
        type: 'map',
        data: { center, markers, connections: validConnections },
      }
    );
  } catch (error) {
    return createErrorResult(`生成地图失败: ${error}`);
  }
};

/**
 * 区域分析执行器
 */
const analyzeRegionExecutor: ToolExecutor = async (request) => {
  const { region, radius = 100 } = request.parameters;
  
  try {
    // 查找区域中心
    const centerCoords = findCoordinates(region);
    
    if (!centerCoords) {
      return createErrorResult(`找不到区域 "${region}" 的坐标`);
    }
    
    // 查找半径范围内的城市
    const nearbyCities = [];
    for (const [name, coords] of Object.entries(CITY_COORDINATES)) {
      const distance = calculateHaversineDistance(
        centerCoords.lat, centerCoords.lng,
        coords.lat, coords.lng
      );
      if (distance <= radius && name !== region) {
        nearbyCities.push({
          name,
          distance: Math.round(distance * 10) / 10,
          country: coords.country,
          coordinates: { lat: coords.lat, lng: coords.lng },
        });
      }
    }
    
    // 按距离排序
    nearbyCities.sort((a, b) => a.distance - b.distance);
    
    return createSuccessResult(
      {
        region: {
          name: centerCoords.name,
          center: { lat: centerCoords.lat, lng: centerCoords.lng },
          country: centerCoords.country,
        },
        radius,
        nearbyCities: nearbyCities.slice(0, 20),
        stats: {
          totalCities: nearbyCities.length,
          avgDistance: nearbyCities.length > 0
            ? Math.round(nearbyCities.reduce((s, c) => s + c.distance, 0) / nearbyCities.length * 10) / 10
            : 0,
        },
      },
      `"${region}" 半径 ${radius}km 范围内有 ${nearbyCities.length} 个城市`,
      {
        type: 'map',
        data: {
          center: { lat: centerCoords.lat, lng: centerCoords.lng },
          markers: [
            { name: centerCoords.name, coordinates: { lat: centerCoords.lat, lng: centerCoords.lng }, type: 'region', significance: '中心', importance: 2 },
            ...nearbyCities.slice(0, 20).map(c => ({
              name: c.name,
              coordinates: c.coordinates,
              type: 'city',
              significance: `${c.distance}km`,
              importance: 1,
            })),
          ],
        },
      }
    );
  } catch (error) {
    return createErrorResult(`区域分析失败: ${error}`);
  }
};

/**
 * 路径规划执行器
 */
const planRouteExecutor: ToolExecutor = async (request) => {
  const { waypoints, optimize = false } = request.parameters;
  
  try {
    if (waypoints.length < 2) {
      return createErrorResult('至少需要两个途经点');
    }
    
    // 解析所有途经点
    const resolvedWaypoints = waypoints.map((wp: string) => {
      const coords = findCoordinates(wp);
      return coords ? { ...coords } : null;
    });
    
    const failedPoints = waypoints.filter((_: string, i: number) => !resolvedWaypoints[i]);
    if (failedPoints.length > 0) {
      return createErrorResult(`无法解析位置: ${failedPoints.join(', ')}`);
    }
    
    // 计算路径
    let route = resolvedWaypoints as Array<{ name: string; lat: number; lng: number }>;
    let totalDistance = 0;
    
    if (optimize && route.length > 2) {
      // 简单的最近邻算法优化路径
      const optimizedRoute: typeof route = [route[0]];
      const remaining = route.slice(1);
      
      while (remaining.length > 0) {
        const last = optimizedRoute[optimizedRoute.length - 1];
        let nearestIdx = 0;
        let nearestDist = Infinity;
        
        for (let i = 0; i < remaining.length; i++) {
          const dist = calculateHaversineDistance(last.lat, last.lng, remaining[i].lat, remaining[i].lng);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestIdx = i;
          }
        }
        
        optimizedRoute.push(remaining[nearestIdx]);
        remaining.splice(nearestIdx, 1);
      }
      
      route = optimizedRoute;
    }
    
    // 计算总距离
    const segments: Array<{ from: string; to: string; distance: number }> = [];
    for (let i = 0; i < route.length - 1; i++) {
      const dist = calculateHaversineDistance(route[i].lat, route[i].lng, route[i + 1].lat, route[i + 1].lng);
      segments.push({
        from: route[i].name,
        to: route[i + 1].name,
        distance: Math.round(dist * 10) / 10,
      });
      totalDistance += dist;
    }
    
    return createSuccessResult(
      {
        route: route.map(r => r.name),
        segments,
        totalDistance: {
          kilometers: Math.round(totalDistance * 10) / 10,
          miles: Math.round(totalDistance * 0.621371 * 10) / 10,
        },
        optimized: optimize,
      },
      `路径规划完成，总距离: ${Math.round(totalDistance * 10) / 10} 公里`,
      {
        type: 'map',
        data: {
          center: {
            lat: route.reduce((s, r) => s + r.lat, 0) / route.length,
            lng: route.reduce((s, r) => s + r.lng, 0) / route.length,
          },
          markers: route.map((r, i) => ({
            name: r.name,
            coordinates: { lat: r.lat, lng: r.lng },
            type: 'waypoint',
            significance: i === 0 ? '起点' : i === route.length - 1 ? '终点' : `途经点${i}`,
            importance: i === 0 || i === route.length - 1 ? 2 : 1,
          })),
          connections: segments.map((s, i) => ({
            from: s.from,
            to: s.to,
            type: 'route',
            strength: 1,
          })),
        },
      }
    );
  } catch (error) {
    return createErrorResult(`路径规划失败: ${error}`);
  }
};

// ============================================================================
// 注册工具
// ============================================================================

export function registerGeoMapTools(registry: {
  register: (def: ToolDefinition, executor: ToolExecutor) => void;
}): void {
  registry.register(geocodeDefinition, geocodeExecutor);
  registry.register(batchGeocodeDefinition, batchGeocodeExecutor);
  registry.register(calculateDistanceDefinition, calculateDistanceExecutor);
  registry.register(generateMapDefinition, generateMapExecutor);
  registry.register(analyzeRegionDefinition, analyzeRegionExecutor);
  registry.register(planRouteDefinition, planRouteExecutor);
}
