import React from "react";
import { connect } from "react-redux";
import * as actions from "../actions";

interface CommentBoxProps {
    saveComment: (comment: string) => void;
}

class CommentBox extends React.Component<CommentBoxProps> {
    state = { comment: '' };

    private handleChange = (event: { target: { value: any; }; }) => {
        this.setState({ comment: event.target.value });
        console.log("boo:",this.state.comment);
    };

    private handleSubmit = (event: { preventDefault: () => void; }) => {
        event.preventDefault();
        // Call an action creator
        console.log("submit:",this.state.comment);
        console.log("submit: props: ",this.props);
        // And save the comment
        this.props.saveComment(this.state.comment);
        this.setState({ comment: '' });
    };

    render() {
        return (
                <label >Comment:
            <form onSubmit={this.handleSubmit}>

                <input  type="text" name="comment" onChange={this.handleChange} value={this.state.comment}/>
                <button type="submit">Submit</button>
            </form>
                </label>
        );
    }
}

// const d = () => {
//   return <div>CommentBox</div>;
// }

export default connect(null, actions) (CommentBox);
