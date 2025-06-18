import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { postComment } from "../slices/commentsSlice";
import { RootState } from "../store";
import requireAuth from "./requireAuth";
import "../styles/CommentBox.css";

const CommentBox: React.FC = () => {
  const dispatch = useDispatch();
  const [comment, setComment] = useState("");
  const { token } = useSelector((state: RootState) => state.auth);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setComment(event.target.value);
  };
  useEffect(() => {
    console.log("CommentBox was rendered (mounted)");
  });
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) {
      alert("You must be logged in to comment.");
      return;
    }
    dispatch(postComment(comment) as any);
    setComment("");
  };

  return (
    <form onSubmit={handleSubmit} className="comment-box">
      <h4>Add a Comment</h4>
      <textarea value={comment} onChange={handleChange} />
      <div>
        <button>Submit Comment</button>
      </div>
    </form>
  );
};

export default CommentBox;
