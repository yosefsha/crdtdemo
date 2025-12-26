"use strict";
// Common types used across CRDT implementations
Object.defineProperty(exports, "__esModule", { value: true });
exports.rgbaToHex = rgbaToHex;
exports.hexToRgba = hexToRgba;
exports.packedToHex = packedToHex;
exports.hexToPacked = hexToPacked;
// Helper functions to convert between formats
function rgbaToHex(r, g, b, a = 255) {
  const toHex = (n) => n.toString(16).padStart(2, "0");
  return toHex(r) + toHex(g) + toHex(b) + toHex(a);
}
function hexToRgba(hex) {
  // Remove # if present
  hex = hex.replace("#", "");
  // Parse hex string (supports both RGBHEX and RGBA)
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const a = hex.length === 8 ? parseInt(hex.substring(6, 8), 16) : 255;
  return { r, g, b, a };
}
// Convert packed integer to hex (for array format migration later)
function packedToHex(packed) {
  const r = (packed >>> 24) & 0xff;
  const g = (packed >>> 16) & 0xff;
  const b = (packed >>> 8) & 0xff;
  const a = packed & 0xff;
  return rgbaToHex(r, g, b, a);
}
// Convert hex to packed integer (for array format migration later)
function hexToPacked(hex) {
  const { r, g, b, a } = hexToRgba(hex);
  return (
    ((r & 0xff) << 24) | ((g & 0xff) << 16) | ((b & 0xff) << 8) | (a & 0xff)
  );
}
