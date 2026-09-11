import { describe, it, expect } from "vitest";
import { transformStyle, animVars, SHAPE_PATHS } from "~/utils/decorationRender";

describe("transformStyle", () => {
  it("centres a scale×avatar box and offsets it in avatar diameters", () => {
    expect(transformStyle({ x: 0.25, y: -0.5, scale: 0.5, rotation: 30 }, 100)).toEqual({
      position: "absolute",
      left: "50%",
      top: "50%",
      width: "50px",
      height: "50px",
      transform: "translate(-50%, -50%) translate(25px, -50px) rotate(30deg)",
    });
  });
});

describe("animVars", () => {
  it("maps direction to animation-direction and seconds to CSS time", () => {
    expect(animVars(6, "ccw")).toEqual({ "--deco-dur": "6s", "--deco-dir": "reverse" });
    expect(animVars(2, "cw", -1.5)).toEqual({ "--deco-dur": "2s", "--deco-dir": "normal", "--deco-delay": "-1.5s" });
  });
});

describe("SHAPE_PATHS", () => {
  it("has a path for every built-in particle shape", () => {
    expect(Object.keys(SHAPE_PATHS).sort()).toEqual(["dot", "heart", "plus", "sparkle", "star"]);
  });
});
