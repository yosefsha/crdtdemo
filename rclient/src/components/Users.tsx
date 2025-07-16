import React from "react";

const Users: React.FC = () => {
  return <h1>Users</h1>;
};

export default Users;

/*
  This component is a placeholder for user management functionality.
  It can be extended to include user authentication, registration, and
  management features as needed.

users drop box
    {syncOption === "otherUser" && otherUsers.length > 0 && (
        <UsersDrop
          users={users}
          userName={userName}
          selectedOtherUser={selectedOtherUser}
          setSelectedOtherUser={setSelectedOtherUser}
          sliceKey={sliceKey}
        />
      )}

        // Fetch users list on mount
  React.useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch(`${config.apiDomain}/users`);
        if (!res.ok) return;
        const data = await res.json();
        setUsers(data.users || []);
      } catch (err) {
        console.error(`[${getTimestamp()}] [ERROR] Failed to fetch users`, err);
      }
    }
    fetchUsers();
  }, []);
*/
