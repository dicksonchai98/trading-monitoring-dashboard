import {
  getHalfGaugeGeometry,
  getNeedleStyle,
} from "@/features/dashboard/components/DashboardMetricPanels";

describe("DashboardMetricPanels geometry", () => {
  it("uses a bottom-centered pivot for the half gauge", () => {
    const geometry = getHalfGaugeGeometry();

    expect(geometry.width).toBe(144);
    expect(geometry.height).toBe(108);
    expect(geometry.cx).toBe(72);
    expect(geometry.cy).toBe(82);
    expect(geometry.innerRadius).toBe(24);
    expect(geometry.outerRadius).toBe(40);
  });

  it("rotates the needle around the same half-gauge center", () => {
    const style = getNeedleStyle(90, 72, 82);

    expect(style.transform).toBe("rotate(-90deg)");
    expect(style.transformOrigin).toBe("72px 82px");
  });
});
