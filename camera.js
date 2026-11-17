// Positive pitch looks up. Both the renderer and picking use this convention.
export function lookDirection(yaw, pitch) {
  return [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
}
export function viewPoint(point, eye, yaw, pitch) {
  const [x, y, z] = point.map((v, i) => v - eye[i]);
  const sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
  const depth = sy * x + cy * z;
  return [cy * x - sy * z, cp * y + sp * depth, -sp * y + cp * depth];
}
export function mouseLook(yaw, pitch, dx, dy, sensitivity, invertY) {
  return [yaw - dx * sensitivity, Math.max(-1.5, Math.min(1.5, pitch - dy * sensitivity * (invertY ? -1 : 1)))];
}
