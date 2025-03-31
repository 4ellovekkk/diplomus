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
    const searchQuery = document.getElementById('searchInput').value;
    const sortField = document.getElementById('sortField').value;
    const sortOrder = document.getElementById('sortOrder').value;
    const limit = document.getElementById('limit').value;

    // Show loading indicator
    document.getElementById('loadingIndicator').style.display = 'block';
    document.getElementById('userTableBody').innerHTML = '';
    document.getElementById('paginationControls').innerHTML = '';

    // Construct the URL with query parameters
    let url = `/api/users?search=${encodeURIComponent(searchQuery)}&sort=${sortField}&order=${sortOrder}&page=${page}&limit=${limit}`;

    // Fetch users from the server
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                updateUserTable(data.data);
                updatePaginationControls(data.pagination);
            } else {
                throw new Error(data.message || 'Failed to fetch users');
            }
        })
        .catch(error => {
            console.error('Error fetching users:', error);
            alert('Error fetching users: ' + error.message);
        })
        .finally(() => {
            document.getElementById('loadingIndicator').style.display = 'none';
        });
}

// Function to update the user table with new data
function updateUserTable(users) {
    const tableBody = document.getElementById('userTableBody');
    tableBody.innerHTML = ''; // Clear existing rows

    if (users.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="7" style="text-align: center;">No users found</td>';
        tableBody.appendChild(row);
        return;
    }

    users.forEach(user => {
        const row = document.createElement('tr');

        // Format the date for display
        const createdAt = new Date(user.created_at);
        const formattedDate = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}-${String(createdAt.getDate()).padStart(2, '0')}`;

        row.innerHTML = `
                <td>${user.id}</td>
                <td>${user.username}</td>
                <td>${user.email}</td>
                <td>${user.role}</td>
                <td>${user.is_locked ? 'Locked' : 'Active'}</td>
                <td>${formattedDate}</td>
                <td>
                    <button class="view" onclick="viewUser(${user.id})">View</button>
                    <button class="edit" onclick="editUser(${user.id})">Edit</button>
                    <button class="delete" onclick="deleteUser(${user.id})">Delete</button>
                    ${user.is_locked ?
            `<button class="unlock" onclick="unlockUser(${user.id})">Unlock</button>` :
            `<button class="lock" onclick="lockUser(${user.id})">Lock</button>`}
                </td>
            `;

        tableBody.appendChild(row);
    });
}

// Function to update pagination controls
function updatePaginationControls(pagination) {
    const paginationDiv = document.getElementById('paginationControls');
    paginationDiv.innerHTML = '';

    totalPages = pagination.totalPages;

    // Previous button
    const prevButton = document.createElement('button');
    prevButton.textContent = 'Previous';
    prevButton.disabled = currentPage === 1;
    prevButton.onclick = () => fetchUsers(currentPage - 1);
    paginationDiv.appendChild(prevButton);

    // Page info
    const pageInfo = document.createElement('span');
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    paginationDiv.appendChild(pageInfo);

    // Next button
    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next';
    nextButton.disabled = currentPage >= totalPages;
    nextButton.onclick = () => fetchUsers(currentPage + 1);
    paginationDiv.appendChild(nextButton);
}

// Function to view user details
function viewUser(userId) {
    fetch(`/api/users/${userId}`)
        .then(response => {
            if (!response.ok) throw new Error('User not found');
            return response.json();
        })
        .then(user => {
            // Format the date for display
            const createdAt = new Date(user.created_at);
            const formattedDate = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}-${String(createdAt.getDate()).padStart(2, '0')} ${String(createdAt.getHours()).padStart(2, '0')}:${String(createdAt.getMinutes()).padStart(2, '0')}`;

            // Populate the form
            document.getElementById('viewUserId').value = user.id;
            document.getElementById('viewUsername').value = user.username;
            document.getElementById('viewEmail').value = user.email;
            document.getElementById('viewRole').value = user.role;
            document.getElementById('viewStatus').value = user.is_locked ? 'Locked' : 'Active';
            document.getElementById('viewCreatedAt').value = formattedDate;

            // Show the modal
            document.getElementById('viewUserModal').style.display = 'block';
        })
        .catch(error => {
            console.error('Error fetching user:', error);
            alert('Error fetching user details: ' + error.message);
        });
}

// Function to close the view user modal
function closeViewUserModal() {
    document.getElementById('viewUserModal').style.display = 'none';
}


// Function to edit user
function editUser(userId) {
    fetch(`/api/users/${userId}`)
        .then(response => {
            if (!response.ok) throw new Error('User not found');
            return response.json();
        })
        .then(user => {
            document.getElementById('formTitle').textContent = 'Edit User';
            document.getElementById('userId').value = user.id;
            document.getElementById('username').value = user.username;
            document.getElementById('email').value = user.email;
            document.getElementById('password').value = ''; // Don't pre-fill password
            document.getElementById('role').value = user.role;

            // Show the modal
            document.getElementById('userFormModal').style.display = 'block';
        })
        .catch(error => {
            console.error('Error fetching user:', error);
            alert('Error loading user for editing: ' + error.message);
        });
}

// Function to delete user
function deleteUser(userId) {
    if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        fetch(`/api/users/${userId}`, {
            method: 'DELETE'
        })
            .then(response => {
                if (!response.ok) throw new Error('Failed to delete user');
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    alert('User deleted successfully');
                    fetchUsers(currentPage); // Refresh current page
                } else {
                    throw new Error(data.message || 'Failed to delete user');
                }
            })
            .catch(error => {
                console.error('Error deleting user:', error);
                alert('Error deleting user: ' + error.message);
            });
    }
}

// Function to lock user
function lockUser(userId) {
    fetch(`/api/users/${userId}/lock`, {
        method: 'PATCH'
    })
        .then(response => {
            if (!response.ok) throw new Error('Failed to lock user');
            return response.json();
        })
        .then(data => {
            if (data.success) {
                alert('User locked successfully');
                fetchUsers(currentPage); // Refresh current page
            } else {
                throw new Error(data.message || 'Failed to lock user');
            }
        })
        .catch(error => {
            console.error('Error locking user:', error);
            alert('Error locking user: ' + error.message);
        });
}

// Function to unlock user
function unlockUser(userId) {
    fetch(`/api/users/${userId}/lock`, {
        method: 'PATCH'
    })
        .then(response => {
            if (!response.ok) throw new Error('Failed to unlock user');
            return response.json();
        })
        .then(data => {
            if (data.success) {
                alert('User unlocked successfully');
                fetchUsers(currentPage); // Refresh current page
            } else {
                throw new Error(data.message || 'Failed to unlock user');
            }
        })
        .catch(error => {
            console.error('Error unlocking user:', error);
            alert('Error unlocking user: ' + error.message);
        });
}

// Function to save user (create or update)
function saveUser(event) {
    event.preventDefault();

    const userId = document.getElementById('userId').value;
    const url = userId ? `/api/users/${userId}` : '/api/users';
    const method = userId ? 'PUT' : 'POST';

    const userData = {
        username: document.getElementById('username').value,
        email: document.getElementById('email').value,
        role: document.getElementById('role').value
    };

    // Only include password if it's not empty (for updates)
    const password = document.getElementById('password').value;
    if (password) {
        userData.password = password;
    }

    fetch(url, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',

        },
        body: JSON.stringify(userData)
    })
        .then(response => {
            if (!response.ok) throw new Error(userId ? 'Failed to update user' : 'Failed to create user');
            return response.json();
        })
        .then(data => {
            if (data.success) {
                closeUserForm();
                alert(userId ? 'User updated successfully' : 'User created successfully');
                fetchUsers(currentPage); // Refresh current page
            } else {
                throw new Error(data.message || (userId ? 'Failed to update user' : 'Failed to create user'));
            }
        })
        .catch(error => {
            console.error('Error saving user:', error);
            alert('Error saving user: ' + error.message);
        });
}

// Function to close the user form modal
function closeUserForm() {
    document.getElementById('userFormModal').style.display = 'none';
    document.getElementById('userForm').reset();
    document.getElementById('userId').value = '';
    document.getElementById('formTitle').textContent = 'Create User';
}

// Initialize the page by fetching users when it loads
document.addEventListener('DOMContentLoaded', function() {
    fetchUsers();
});