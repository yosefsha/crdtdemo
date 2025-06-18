import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { fetchComments } from "../slices/commentsSlice";
import css from "../styles/CommentsList.module.css";
import { RootState } from "../store";

const CommentsList: React.FC = () => {
  const dispatch = useDispatch();
  const { items, status, error } = useSelector(
    (state: RootState) => state.comments
  );

  useEffect(() => {
    dispatch(fetchComments() as any);
  }, [dispatch]);

  if (status === "loading") return <div>Loading comments...</div>;
  if (status === "failed") return <div>Error: {error}</div>;

  return (
    <div className={css.comments}>
      <h3>Comments list:</h3>
      <ul>
        {items.map((comment: any, index: number) => (
          <li key={index}>{comment.body || comment}</li>
        ))}
      </ul>
    </div>
  );
};

export default CommentsList;
