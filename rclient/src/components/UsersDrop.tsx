import React from "react";

interface UsersDropProps {
  users: any[];
  userName: string;
  selectedOtherUser: string;
  setSelectedOtherUser: (id: string) => void;
  sliceKey: string;
}

const UsersDrop: React.FC<UsersDropProps> = ({
  users,
  userName,
  selectedOtherUser,
  setSelectedOtherUser,
  sliceKey,
}) => {
  const otherUsers = users.filter(
    (u) => (u.userId || u._id) !== userName.toLowerCase()
  );
  if (otherUsers.length === 0) return null;
  return (
    <div style={{ margin: "1em 0" }}>
      <label htmlFor={`other-user-select-${sliceKey}`}>Sync from user: </label>
      <select
        id={`other-user-select-${sliceKey}`}
        value={selectedOtherUser}
        onChange={(e) => setSelectedOtherUser(e.target.value)}
      >
        <option value="">-- Select user --</option>
        {otherUsers.map((u) => (
          <option key={u.userId || u._id} value={u.userId || u._id}>
            {u.userId || u._id}
          </option>
        ))}
      </select>
    </div>
  );
};

export default UsersDrop;
