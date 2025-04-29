// Debounce function to limit how often fetchUsers is called during typing
let debounceTimer;
function debouncedFetchUsers() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    fetchUsers();
  }, 500);
}

// Current page tracking
let currentPage = 1;
let totalPages = 1;

// Function to fetch users with search, sort, and pagination parameters
function fetchUsers(page = 1) {
  currentPage = page;
  const searchQuery = document.getElementById("searchInput").value;
  const sortField = document.getElementById("sortField").value;
  const sortOrder = document.getElementById("sortOrder").value;
  const limit = document.getElementById("limit").value;

  // Show loading indicator
  document.getElementById("loadingIndicator").style.display = "block";
  document.getElementById("userTableBody").innerHTML = "";
  document.getElementById("paginationControls").innerHTML = "";

  // Construct the URL with query parameters
  let url = `/api/users?search=${encodeURIComponent(searchQuery)}&sort=${sortField}&order=${sortOrder}&page=${page}&limit=${limit}`;

  // Fetch users from the server
  fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    })
    .then((data) => {
      if (data.success) {
        updateUserTable(data.data);
        updatePaginationControls(data.pagination);
      } else {
        throw new Error(data.message || "Failed to fetch users");
      }
    })
    .catch((error) => {
      console.error("Error fetching users:", error);
      alert("Error fetching users: " + error.message);
    })
    .finally(() => {
      document.getElementById("loadingIndicator").style.display = "none";
    });
}

// Function to update the user table with new data
function updateUserTable(users) {
  const tableBody = document.getElementById("userTableBody");
  tableBody.innerHTML = ""; // Clear existing rows

  if (users.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML =
      '<td colspan="7" style="text-align: center;">No users found</td>';
    tableBody.appendChild(row);
    return;
  }

  users.forEach((user) => {
    const row = document.createElement("tr");

    // Format the date for display
    const createdAt = new Date(user.created_at);
    const formattedDate = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, "0")}-${String(createdAt.getDate()).padStart(2, "0")}`;

    row.innerHTML = `
                <td>${user.id}</td>
                <td>${user.username}</td>
                <td>${user.email}</td>
                <td>${user.role}</td>
                <td>${user.is_locked ? "Locked" : "Active"}</td>
                <td>${formattedDate}</td>

<td>
    <button class="btn btn-sm btn-outline-primary me-1" title="View" onclick="viewUser(${user.id})">
        <i class="bi bi-eye"></i>
    </button>
    <button class="btn btn-sm btn-outline-secondary me-1" title="Edit" onclick="editUser(${user.id})">
        <i class="bi bi-pencil"></i>
    </button>
    <button class="btn btn-sm btn-outline-danger me-1" title="Delete" onclick="deleteUser(${user.id})">
        <i class="bi bi-trash"></i>
    </button>
    <button class="btn btn-sm btn-outline-warning" title="${user.is_locked ? "Unlock" : "Lock"}" onclick="toggleUserLock(${user.id})">
        <i class="bi ${user.is_locked ? "bi-unlock" : "bi-lock"}"></i>
    </button>
</td>
            `;

    tableBody.appendChild(row);
  });
}

// Function to update pagination controls

function updatePaginationControls(pagination) {
  const paginationDiv = document.getElementById("paginationControls");
  paginationDiv.innerHTML = "";

  totalPages = pagination.totalPages;

  // Previous button
  const prevButton = document.createElement("button");
  prevButton.textContent = "Previous";
  prevButton.classList.add("btn", "btn-outline-primary");
  prevButton.disabled = currentPage === 1;
  prevButton.onclick = () => fetchUsers(currentPage - 1);
  paginationDiv.appendChild(prevButton);

  // Page info
  const pageInfo = document.createElement("span");
  pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  pageInfo.classList.add("align-self-center");
  paginationDiv.appendChild(pageInfo);

  // Next button
  const nextButton = document.createElement("button");
  nextButton.textContent = "Next";
  nextButton.classList.add("btn", "btn-outline-primary");
  nextButton.disabled = currentPage >= totalPages;
  nextButton.onclick = () => fetchUsers(currentPage + 1);
  paginationDiv.appendChild(nextButton);
}
function setFormReadOnly(isReadOnly) {
  const formFields = document.querySelectorAll("#viewUserModal input");

  formFields.forEach((field) => {
    if (isReadOnly) {
      field.setAttribute("readonly", "readonly");
    } else {
      field.removeAttribute("readonly");
    }
  });
}
// Function to view user details
function viewUser(id) {
  fetch(`/api/users/${id}`)
    .then((response) => {
      if (!response.ok) throw new Error("User not found");
      return response.json();
    })
    .then((data) => {
      const user = data.user;

      // Set basic user info
      document.getElementById("viewUserId").value = user.id || "—";
      document.getElementById("viewUsername").value = user.username || "—";
      document.getElementById("viewEmail").value = user.email || "—";
      document.getElementById("viewRole").value = user.role || "—";
      document.getElementById("viewStatus").value = user.is_locked
        ? "Locked"
        : "Active";
      document.getElementById("viewCreatedAt").value = user.created_at
        ? new Date(user.created_at).toLocaleString()
        : "—";

      // Set optional fields with fallback
      document.getElementById("viewName").value = user.name || "—";
      document.getElementById("viewPhone").value = user.phone || "—";
      document.getElementById("viewAddress").value = user.adress || "—";
      setFormReadOnly(true);
      // Show the modal
      const userModal = new bootstrap.Modal(
        document.getElementById("viewUserModal"),
      );
      userModal.show();
    })
    .catch((error) => {
      console.error("Error fetching user:", error);
      alert("Error loading user details: " + error.message);
    });
} // Function to close the view user modal
function closeViewUserModal() {
  document.getElementById("viewUserModal").style.display = "none";
}

// Function to edit user

function editUser(userId) {
  fetch(`/api/users/${userId}`)
    .then((response) => {
      if (!response.ok) throw new Error("User not found");
      return response.json();
    })
    .then((data) => {
      const user = data.user;
      // Populate the fields in the modal form
      document.getElementById("viewUserId").value = user.id;
      document.getElementById("viewUsername").value = user.username;
      document.getElementById("viewEmail").value = user.email;
      document.getElementById("viewRole").value = user.role;
      document.getElementById("viewStatus").value = user.status;
      document.getElementById("viewCreatedAt").value = new Date(
        user.createdAt,
      ).toLocaleString();
      document.getElementById("viewName").value = user.name || ""; // Set 'name' if available
      document.getElementById("viewPhone").value = user.phone || ""; // Set 'phone' if available
      document.getElementById("viewAddress").value = user.address || ""; // Set 'address' if available
      setFormReadOnly(false);
      // Show the modal
      const modalElement = document.getElementById("viewUserModal");
      const userModal = new bootstrap.Modal(modalElement); // Use Bootstrap modal
      userModal.show();
    })
    .catch((error) => {
      console.error("Error fetching user:", error);
      alert("Error loading user for viewing: " + error.message);
    });
}
// Function to delete user
function deleteUser(userId) {
  if (
    confirm(
      "Are you sure you want to delete this user? This action cannot be undone.",
    )
  ) {
    fetch(`/api/users/${userId}`, {
      method: "DELETE",
    })
      .then((response) => {
        if (!response.ok) throw new Error("Failed to delete user");
        return response.json();
      })
      .then((data) => {
        if (data.success) {
          alert("User deleted successfully");
          fetchUsers(currentPage); // Refresh current page
        } else {
          throw new Error(data.message || "Failed to delete user");
        }
      })
      .catch((error) => {
        console.error("Error deleting user:", error);
        alert("Error deleting user: " + error.message);
      });
  }
}
function toggleUserLock(userId) {
  if (!confirm("Are you sure you want to toggle this user's lock status?")) {
    return;
  }

  fetch(`/api/users/${userId}/toggle-lock`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then((response) => {
      if (!response.ok) throw new Error("Failed to update lock status");
      return response.json();
    })
    .then((data) => {
      if (data.success) {
        const action = data.user.is_locked ? "locked" : "unlocked";
        alert(`User account has been ${action} successfully`);
        fetchUsers(currentPage); // Refresh the current user list
      } else {
        throw new Error(data.message || "Operation failed");
      }
    })
    .catch((error) => {
      console.error("Error toggling user lock state:", error);
      alert("Error: " + error.message);
    });
} // Function to save user (create or update)

function saveUserFromModal(event) {
  event.preventDefault();

  const userId = document.getElementById("viewUserId").value;
  const url = userId ? `/api/users/${userId}` : "/api/users";
  const method = userId ? "PUT" : "POST";

  const userData = {
    username: document.getElementById("viewUsername").value,
    email: document.getElementById("viewEmail").value,
    role: document.getElementById("viewRole").value,
    status: document.getElementById("viewStatus").value,
    name: document.getElementById("viewName").value,
    phone: document.getElementById("viewPhone").value,
    address: document.getElementById("viewAddress").value,
  };

  // Optional: handle password only if you add a password field to the modal
  const passwordField = document.getElementById("viewPassword");
  if (passwordField && passwordField.value) {
    userData.password = passwordField.value;
  }

  fetch(url, {
    method: method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(userData),
  })
    .then((response) => {
      if (!response.ok)
        throw new Error(
          userId ? "Failed to update user" : "Failed to create user",
        );
      return response.json();
    })
    .then((data) => {
      if (data.success) {
        const modal = bootstrap.Modal.getInstance(
          document.getElementById("viewUserModal"),
        );
        modal.hide();
        alert(
          userId ? "User updated successfully" : "User created successfully",
        );
        fetchUsers(currentPage); // Refresh the user list
      } else {
        throw new Error(
          data.message ||
            (userId ? "Failed to update user" : "Failed to create user"),
        );
      }
    })
    .catch((error) => {
      console.error("Error saving user:", error);
      alert("Error saving user: " + error.message);
    });
}

// Function to close the user form modal
function closeUserForm() {
  document.getElementById("userFormModal").style.display = "none";
  document.getElementById("userForm").reset();
  document.getElementById("userId").value = "";
  document.getElementById("formTitle").textContent = "Create User";
}

// Initialize the page by fetching users when it loads
document.addEventListener("DOMContentLoaded", function () {
  fetchUsers();
});

