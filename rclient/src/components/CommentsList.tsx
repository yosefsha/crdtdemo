
import React from "react";
import {connect} from "react-redux";

//export default function CommentsList() {
//  return <div>CommentsList</div>;

interface CommentsListProps {
    comments: string[];
}

class CommentsList extends React.Component<CommentsListProps> {
    render() {
        return <div>
            <ul>
             {this.props.comments.map((comment: string) => {
                    return <li key={comment}>{comment}</li>;
             })}
            </ul>
        </div>;
    }
};

function mapStateToProps(state: { comments: string[]; }) {
    console.log("CommentsList: mapStateToProps: state: ",state);
    return { comments: state.comments };
}

export default connect(mapStateToProps,null)(CommentsList);