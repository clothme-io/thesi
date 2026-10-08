import { describe, expect, it } from "vitest";
import {
  creativeDirectionFormFrom,
  creativeDirectionFromForm,
  emptyCreativeDirection,
} from "./creative-direction";

describe("creative direction", () => {
  it("stays empty when a draft or published campaign has no direction yet", () => {
    expect(creativeDirectionFromForm(creativeDirectionFormFrom())).toEqual(
      emptyCreativeDirection(),
    );
  });

  it("keeps multiple audience and video selections", () => {
    const saved = creativeDirectionFromForm({
      audience: {
        ageRanges: ["18-24", "25-34"],
        genders: ["women"],
        lifeStages: ["parent", "young_professional"],
        workRoles: ["office", "healthcare"],
        shopperStyles: ["everyday", "premium"],
        note: "Work outfits",
      },
      video: {
        styles: ["talking_head", "green_screen"],
        face: "on_camera",
        settings: ["at_home", "outdoors"],
        length: "15_30s",
        mustIncludeText: "Show the fit\nMention the app",
        avoidText: "No heavy filters",
      },
    });

    expect(saved.audience.ageRanges).toEqual(["18-24", "25-34"]);
    expect(saved.audience.lifeStages).toEqual(["parent", "young_professional"]);
    expect(saved.audience.workRoles).toEqual(["office", "healthcare"]);
    expect(saved.audience.shopperStyles).toEqual(["everyday", "premium"]);
    expect(saved.video.styles).toEqual(["talking_head", "green_screen"]);
    expect(saved.video.mustInclude).toEqual(["Show the fit", "Mention the app"]);
  });
});
