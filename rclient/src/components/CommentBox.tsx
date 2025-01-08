import React from "react";
import { connect } from "react-redux";
import * as actions from "../actions";

interface CommentBoxProps {
  saveComment: (comment: string) => void;
  fetchComments: () => void;
}

class CommentBox extends React.Component<CommentBoxProps> {
  state = { comment: "" };

  private handleChange = (event: { target: { value: any } }) => {
    this.setState({ comment: event.target.value });
    console.log("boo:", this.state.comment);
  };

  private handleSubmit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    // Call an action creator
    console.log(
      "CommentBox:handleSubmit:this.state.comment: ",
      this.state.comment
    );
    console.log("CommentBox:handleSubmit: this.props: ", this.props);
    // And save the comment
    this.props.saveComment(this.state.comment);
    this.setState({ comment: "" });
  };

  render() {
    return (
      <div>
        <label>
          Comment:
          <form onSubmit={this.handleSubmit}>
            <input
              type="text"
              name="comment"
              onChange={this.handleChange}
              value={this.state.comment}
            />
            <br />
            <button type="submit">Submit</button>
          </form>
        </label>
        <br />
        <button onClick={this.props.fetchComments}>fetch some comments</button>
      </div>
    );
  }
}

// const d = () => {
//   return <div>CommentBox</div>;
// }

export default connect(null, actions)(CommentBox);
