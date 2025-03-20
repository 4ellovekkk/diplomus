async function updateUserRole(userId, newRole) {
    await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole })
    });
    location.reload();
}

async function toggleLockUser(userId) {
    await fetch(`/api/users/${userId}/lock`, { method: "PATCH" });
    location.reload();
}

async function deleteUser(userId) {
    if (confirm("Are you sure you want to delete this user?")) {
        await fetch(`/api/users/${userId}`, { method: "DELETE" });
        location.reload();
    }
}

function showCreateUserForm() {
    document.getElementById("formTitle").innerText = "Create User";
    document.getElementById("userForm").reset();
    document.getElementById("userId").value = "";
    document.getElementById("userFormModal").style.display = "block";
}

function editUser(userId) {
    fetch(`/api/users/${userId}`)
        .then(res => res.json())
        .then(user => {
            document.getElementById("formTitle").innerText = "Edit User";
            document.getElementById("userId").value = user.id;
            document.getElementById("username").value = user.username;
            document.getElementById("email").value = user.email;
            document.getElementById("role").value = user.role;
            document.getElementById("userFormModal").style.display = "block";
        });
}


async function saveUser(event) {
    event.preventDefault();

    const userId = document.getElementById("userId").value;
    const username = document.getElementById("username").value;
    const email = document.getElementById("email").value;
    const role = document.getElementById("role").value;
    const password = document.getElementById("password").value;

    // Only send password field if creating a new user
    const user = { username, email, role };
    if (!userId && password.trim()) {
        user.password = password;
    }

    const method = userId ? "PUT" : "POST";
    const url = userId ? `/api/users/${userId}` : "/api/users";

    try {
        const response = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(user)
        });

        if (!response.ok) {
            const errorData = await response.json();
            alert(`Error: ${errorData.message || "Failed to save user"}`);
            return;
        }

        closeUserForm();
        location.reload();
    } catch (error) {
        console.error("Error saving user:", error);
        alert("An unexpected error occurred.");
    }
}


function closeUserForm() {
    document.getElementById("userFormModal").style.display = "none";
}

//-----------------------------------------------
async function fetchUsers() {
    const search = document.getElementById("searchInput").value.trim();
    const sortBy = document.getElementById("sortField").value;
    const order = document.getElementById("sortOrder").value;

    const queryParams = new URLSearchParams({ search, sortBy, order }).toString();
    const response = await fetch(`/api/users?${queryParams}`);

    const users = await response.json();
    renderUsers(users);
}

function renderUsers(users) {
    const tbody = document.getElementById("userTableBody");
    tbody.innerHTML = "";
    users.forEach(user => {
        tbody.innerHTML += `
            <tr>
                <td>${user.id}</td>
                <td>${user.username}</td>
                <td>${user.email}</td>
                <td>
                    <select onchange="updateUserRole(${user.id}, this.value)">
                        <option value="customer" ${user.role === 'customer' ? 'selected' : ''}>Customer</option>
                        <option value="employee" ${user.role === 'employee' ? 'selected' : ''}>Employee</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </td>
                <td>
                    <button onclick="toggleLockUser(${user.id})" class="${user.is_locked ? 'locked' : 'unlocked'}">
                        ${user.is_locked ? 'Locked' : 'Active'}
                    </button>
                </td>
                <td>
                    <button onclick="editUser(${user.id})">Edit</button>
                    <button onclick="deleteUser(${user.id})" class="btn-danger">Delete</button>
                </td>
            </tr>`;
    });
}
