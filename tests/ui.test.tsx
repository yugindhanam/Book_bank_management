import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { Empty, Badge } from "../src/components/ui";
describe("accessible information states", () => {
  it("explains empty records without invented statistics", () => {
    render(<Empty title="No loans to show" text="Issue a book to begin." />);
    expect(
      screen.getByRole("heading", { name: "No loans to show" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Issue a book to begin.")).toBeInTheDocument();
  });
  it("uses text as well as colour for status", () => {
    render(<Badge tone="danger">Overdue</Badge>);
    expect(screen.getByText("Overdue")).toBeVisible();
  });
});
