import React from "react";
import { connect } from "react-redux";
import css from "../styles/CommentsList.module.css";

interface CommentsListProps {
  comments: string[];
}

class CommentsList extends React.Component<CommentsListProps> {
  render() {
    return (
      <div className={css.comments}>
        <h3>Comments list:</h3>
        <ul>
          {this.props.comments.map((comment: string, index: number) => {
            return <li key={index}>{comment}</li>;
          })}
        </ul>
      </div>
    );
  }
}

function mapStateToProps(state: { comments: string[] }) {
  console.log("CommentsList: mapStateToProps: state: ", state);
  return { comments: state.comments };
}

export default connect(mapStateToProps, null)(CommentsList);
