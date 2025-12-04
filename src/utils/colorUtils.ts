import type { ColorStop, RGBAColor } from '../config/types';
import { COLOR_STOPS } from '../config/constants';

/**
 * Get interpolated color for a flow height value
 * Uses linear interpolation between configured color stops
 */
export function getColorFromHeight(value: number, stops: ColorStop[] = COLOR_STOPS): RGBAColor {
  // Below minimum - return first color
  if (value <= stops[0].value) {
    return [...stops[0].color] as RGBAColor;
  }

  // Above maximum - return last color
  if (value >= stops[stops.length - 1].value) {
    return [...stops[stops.length - 1].color] as RGBAColor;
  }

  // Find the two stops to interpolate between
  for (let i = 1; i < stops.length; i++) {
    if (value <= stops[i].value) {
      const prev = stops[i - 1];
      const curr = stops[i];
      const t = (value - prev.value) / (curr.value - prev.value);

      return [
        Math.round(prev.color[0] + t * (curr.color[0] - prev.color[0])),
        Math.round(prev.color[1] + t * (curr.color[1] - prev.color[1])),
        Math.round(prev.color[2] + t * (curr.color[2] - prev.color[2])),
        Math.round(prev.color[3] + t * (curr.color[3] - prev.color[3])),
      ] as RGBAColor;
    }
  }

  // Fallback to last color
  return [...stops[stops.length - 1].color] as RGBAColor;
}

/**
 * Average multiple RGBA colors
 */
export function averageColors(colors: RGBAColor[]): RGBAColor {
  if (colors.length === 0) {
    return [0, 0, 0, 0];
  }

  const sum = colors.reduce(
    (acc, color) => [
      acc[0] + color[0],
      acc[1] + color[1],
      acc[2] + color[2],
      acc[3] + color[3],
    ],
    [0, 0, 0, 0]
  );

  return [
    Math.round(sum[0] / colors.length),
    Math.round(sum[1] / colors.length),
    Math.round(sum[2] / colors.length),
    Math.round(sum[3] / colors.length),
  ] as RGBAColor;
}
