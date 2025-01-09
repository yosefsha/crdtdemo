import React from "react";
import Root from "../root";
import App from "../components/App";
import { render, waitFor, fireEvent, screen } from "@testing-library/react";
import { sleep } from "../helpers";

describe("intergation", () => {
  it("can fetch a list of comments and display them", async () => {
    const { container } = render(
      <Root>
        <App />
      </Root>
    );
    const btn = screen.getByText(/Fetch some Comments/i);
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    await sleep(3000);

    const listItems = screen.getAllByRole("listitem");
    expect(listItems.length > 10).toBeTruthy();
  });
});
