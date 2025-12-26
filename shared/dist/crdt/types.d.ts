export type RGBHEX = string;
export declare function rgbaToHex(r: number, g: number, b: number, a?: number): RGBHEX;
export declare function hexToRgba(hex: RGBHEX): {
    r: number;
    g: number;
    b: number;
    a: number;
};
export declare function packedToHex(packed: number): RGBHEX;
export declare function hexToPacked(hex: RGBHEX): number;
//# sourceMappingURL=types.d.ts.map