document.addEventListener("DOMContentLoaded", function () {
    fetchUsers();

    document.getElementById("searchInput").addEventListener("input", filterUsers);
    document.getElementById("sortField").addEventListener("change", sortUsers);
    document.getElementById("sortOrder").addEventListener("change", sortUsers);
});

let users = [];

function fetchUsers() {
    fetch("/api/users")
        .then(response => response.json())
        .then(data => {
            users = data;
            displayUsers(users);
        })
        .catch(error => console.error("Error fetching users:", error));
}

function displayUsers(usersList) {
    const tableBody = document.getElementById("userTableBody");
    tableBody.innerHTML = "";

    usersList.forEach(user => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${user.id}</td>
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td>${user.role}</td>
            <td>${user.is_locked ? 'Locked' : 'Active'}</td>
            <td>
                <button class="edit" onclick="editUser(${user.id})">Изменить</button>
                <button class="delete" onclick="deleteUser(${user.id})">Удалить</button>
                ${user.is_locked ?
            `<button class="unlock" onclick="unlockUser(${user.id})">Разблокировать</button>` :
            `<button class="lock" onclick="lockUser(${user.id})">Заблокировать</button>`
        }
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function filterUsers() {
    const query = document.getElementById("searchInput").value.toLowerCase();
    const filteredUsers = users.filter(user =>
        user.username.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.role.toLowerCase().includes(query)
    );
    displayUsers(filteredUsers);
}

function sortUsers() {
    const field = document.getElementById("sortField").value;
    const order = document.getElementById("sortOrder").value;

    users.sort((a, b) => {
        let valueA = a[field];
        let valueB = b[field];

        if (typeof valueA === "string") valueA = valueA.toLowerCase();
        if (typeof valueB === "string") valueB = valueB.toLowerCase();

        if (order === "asc") return valueA > valueB ? 1 : -1;
        else return valueA < valueB ? 1 : -1;
    });

    displayUsers(users);
}
