import React from "react";

class CommentBox extends React.Component {
    state = { comment: '' };

    private handleChange = (event: { target: { value: any; }; }) => {
        this.setState({ comment: event.target.value });
        console.log("boo:",this.state.comment);
    };

    private handleSubmit = (event: { preventDefault: () => void; }) => {
        event.preventDefault();
        // Call an action creator
        console.log("submit:",this.state.comment);
        // And save the comment
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

export default CommentBox;
