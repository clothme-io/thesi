import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  creativeDirectionFormFrom,
  creativeDirectionFromForm,
} from "@/lib/brand-campaigns/creative-direction";
import { CreativeDirectionFields } from "./CreativeDirectionFields";

function Harness() {
  const [value, setValue] = useState(creativeDirectionFormFrom());
  return (
    <>
      <CreativeDirectionFields value={value} onChange={setValue} />
      <output data-testid="saved">{JSON.stringify(creativeDirectionFromForm(value))}</output>
    </>
  );
}

describe("CreativeDirectionFields", () => {
  afterEach(() => cleanup());

  it("lets a brand select several audience traits and video styles without filling the section", () => {
    render(<Harness />);
    const saved = () =>
      JSON.parse(screen.getByTestId("saved").textContent || "{}") as {
        audience: {
          ageRanges: string[];
          lifeStages: string[];
          workRoles: string[];
          shopperStyles: string[];
        };
        video: { styles: string[] };
      };

    expect(saved().audience.ageRanges).toEqual([]);
    expect(saved().video.styles).toEqual([]);

    fireEvent.click(screen.getByTestId("audience-age-18-24"));
    fireEvent.click(screen.getByTestId("audience-age-35-44"));
    fireEvent.click(screen.getByTestId("audience-life-stage-parent"));
    fireEvent.click(screen.getByTestId("audience-life-stage-student"));
    fireEvent.click(screen.getByTestId("audience-work-office"));
    fireEvent.click(screen.getByTestId("audience-work-healthcare"));
    fireEvent.click(screen.getByTestId("audience-shopper-everyday"));
    fireEvent.click(screen.getByTestId("audience-shopper-premium"));
    fireEvent.click(screen.getByTestId("video-style-talking_head"));
    fireEvent.click(screen.getByTestId("video-style-green_screen"));

    expect(saved().audience.ageRanges).toEqual(["18-24", "35-44"]);
    expect(saved().audience.lifeStages).toEqual(["parent", "student"]);
    expect(saved().audience.workRoles).toEqual(["office", "healthcare"]);
    expect(saved().audience.shopperStyles).toEqual(["everyday", "premium"]);
    expect(saved().video.styles).toEqual(["talking_head", "green_screen"]);
  });
});
