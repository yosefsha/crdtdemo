import React from "react";
import { connect } from "react-redux";
import * as actions from "../actions";
import requireAuth from "./requireAuth";
import "../styles/CommentBox.css"; // Import the new CSS file

interface CommentBoxProps {
  auth: boolean;
  saveComment: (comment: string) => void;
}

class CommentBox extends React.Component<CommentBoxProps> {
  state = { comment: "" };

  private handleChange = (event: { target: { value: any } }) => {
    this.setState({ comment: event.target.value });
    console.log("boo:", this.state.comment);
  };

  private handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    this.props.saveComment(this.state.comment);
    this.setState({ comment: "" });
  };

  render() {
    return (
      <form onSubmit={this.handleSubmit} className="comment-box">
        <h4>Add a Comment</h4>
        <textarea value={this.state.comment} onChange={this.handleChange} />
        <div>
          <button>Submit Comment</button>
        </div>
      </form>
    );
  }
}

const mapStateToProps = (state: any) => {
  return { auth: state.auth };
};

export default connect(mapStateToProps, actions)(requireAuth(CommentBox));
