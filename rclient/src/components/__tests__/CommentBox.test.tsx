// import React, { act } from "react";
// import { render, screen, fireEvent } from "@testing-library/react";
// import CommentBox from "../CommentBox";
// import Root from "../../root";

// describe.skip("CommentBox", () => {
//   it("renders learn react link", () => {
//     render(
//       <Root>
//         <CommentBox />
//       </Root>
//     );
//     const linkElement = screen.getByText(/Comment:/i);
//     act(() => {
//       expect(linkElement).toBeInTheDocument();
//     });
//   });

//   it("simulate change event", () => {
//     render(
//       <Root>
//         <CommentBox />
//       </Root>
//     );
//     const inputs = screen.getAllByLabelText(/Comment:/i);
//     expect(inputs.length).toBe(1);
//     const newValue = "Hello World 2";
//     fireEvent.change(inputs[0], { target: { value: newValue } });
//     expect(inputs[0]).toHaveValue(newValue);
//   });

//   it("simulate change event", () => {
//     render(
//       <Root>
//         <CommentBox />
//       </Root>
//     );
//     const inputs = screen.getAllByLabelText(/Comment:/i);
//     expect(inputs.length).toBe(1);
//     const newValue = "Hello World 2";
//     fireEvent.change(inputs[0], { target: { value: newValue } });
//     expect(inputs[0]).toHaveValue(newValue);

//     fireEvent.submit(inputs[0]);
//     const textarea = screen.getByRole("textbox");
//     expect(textarea).toBeInTheDocument();
//     expect(textarea).toHaveValue("");
//   });

//   it("simulate change event wrong text", () => {
//     render(
//       <Root>
//         <CommentBox />
//       </Root>
//     );
//     const newValue = "Hello World 2";
//     const inputs = screen.getAllByLabelText(/Comment:/i);
//     expect(inputs.length).toBe(1);
//     fireEvent.change(inputs[0], { target: { value: newValue } });
//     expect(inputs[0]).not.toHaveValue(newValue + "1");
//   });
// });
