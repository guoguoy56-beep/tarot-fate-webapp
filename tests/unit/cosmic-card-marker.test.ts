import { describe, expect, it } from "vitest";
import { Vector4 } from "three";
import { cardBackClipMatrix } from "@/lib/cosmic-card-back-projection";
import { cardMarkerPose } from "@/lib/cosmic-card-marker";

describe("screen-space card markers", () => {
  it("grows to its final pixel dimensions while keeping the gap above an enlarged card", () => {
    const pose = { x: 400, y: 500, scale: 1, tilt: 0, yaw: 0, perspective: 900 };
    expect(cardMarkerPose(pose)).toEqual({ x: 400, y: 424, size: 20 });
    expect(cardMarkerPose({ ...pose, scale: 4 })).toEqual({ x: 400, y: 196, size: 80 });
  });

  it("tracks the same top anchor as the actual tilted and perspective-projected card", () => {
    const width = 1480, height = 832;
    for (const [scale, tilt, yaw, perspective] of [[0.7, -12, 20, 900], [3.8, 5, -10, 400], [1.5, 12, 15, 900]]) {
      const pose = { x: 452, y: 630, scale, tilt, yaw, perspective, order: 30 };
      const anchor = new Vector4(0, 76 / 68, 0, 1).applyMatrix4(cardBackClipMatrix(pose, width, height));
      const marker = cardMarkerPose(pose);
      expect(marker.x).toBeCloseTo((anchor.x / anchor.w + 1) * width / 2, 8);
      expect(marker.y).toBeCloseTo((1 - anchor.y / anchor.w) * height / 2, 8);
      expect(marker.size).toBeCloseTo(20 * scale / anchor.w, 8);
    }
  });
});
