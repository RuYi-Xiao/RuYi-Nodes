export const MIN_RESOLUTION = 16;
export const MAX_RESOLUTION = 16384;

export function alignDimension(value, alignment) {
    const step = Number(alignment);
    return Math.max(Math.max(MIN_RESOLUTION, step), Math.min(MAX_RESOLUTION, Math.round(value / step) * step));
}

export function scaleDimensions(width, height, percent, alignment) {
    const minimum = Math.max(MIN_RESOLUTION, Number(alignment));
    const factor = Math.max(minimum / Math.min(width, height), Math.min(percent / 100, MAX_RESOLUTION / Math.max(width, height)));
    return [alignDimension(width * factor, alignment), alignDimension(height * factor, alignment)];
}
