// Get translation function from window object
const t = window.t || ((key) => key);

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
        throw new Error(data.message || t("failed_to_fetch_users"));
      }
    })
    .catch((error) => {
      console.error("Error fetching users:", error);
      alert(t("error_fetching_users") + ": " + error.message);
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
    row.innerHTML = `<td colspan="7" style="text-align: center;">${t("no_users_found")}</td>`;
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
      <td>${user.is_locked ? t("locked") : t("active")}</td>
      <td>${formattedDate}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary me-1" title="${t("view")}" onclick="viewUser(${user.id})">
          <i class="bi bi-eye"></i>
        </button>
        <button class="btn btn-sm btn-outline-secondary me-1" title="${t("edit")}" onclick="editUser(${user.id})">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger me-1" title="${t("delete")}" onclick="deleteUser(${user.id})">
          <i class="bi bi-trash"></i>
        </button>
        <button class="btn btn-sm btn-outline-warning" title="${user.is_locked ? t("unlock") : t("lock")}" onclick="toggleUserLock(${user.id})">
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
  prevButton.textContent = t("previous");
  prevButton.classList.add("btn", "btn-outline-primary");
  prevButton.disabled = currentPage === 1;
  prevButton.onclick = () => fetchUsers(currentPage - 1);
  paginationDiv.appendChild(prevButton);

  // Page info
  const pageInfo = document.createElement("span");
  pageInfo.textContent = t("page_of_total", { current: currentPage, total: totalPages });
  pageInfo.classList.add("align-self-center");
  paginationDiv.appendChild(pageInfo);

  // Next button
  const nextButton = document.createElement("button");
  nextButton.textContent = t("next");
  nextButton.classList.add("btn", "btn-outline-primary");
  nextButton.disabled = currentPage >= totalPages;
  nextButton.onclick = () => fetchUsers(currentPage + 1);
  paginationDiv.appendChild(nextButton);
}

function setFormReadOnly(isReadOnly) {
  const formFields = document.querySelectorAll("#viewUserModal input, #viewUserModal select");

  formFields.forEach((field) => {
    if (isReadOnly) {
      field.setAttribute("readonly", "readonly");
      if (field.tagName === "SELECT") {
        field.setAttribute("disabled", "disabled");
      }
    } else {
      field.removeAttribute("readonly");
      if (field.tagName === "SELECT") {
        field.removeAttribute("disabled");
      }
    }
  });
}

// Function to view user details
function viewUser(id) {
  fetch(`/api/users/${id}`)
    .then((response) => {
      if (!response.ok) throw new Error(t("user_not_found"));
      return response.json();
    })
    .then((data) => {
      const user = data.user;
      const placeholder = "—";

      // Set basic user info
      document.getElementById("viewUserId").value = user.id || placeholder;
      document.getElementById("viewUsername").value = user.username || placeholder;
      document.getElementById("viewEmail").value = user.email || placeholder;
      document.getElementById("viewRole").value = user.role || "customer";
      document.getElementById("viewCreatedAt").value = user.created_at
        ? new Date(user.created_at).toLocaleString()
        : placeholder;

      // Set optional fields with fallback
      document.getElementById("viewName").value = user.name || placeholder;
      document.getElementById("viewPhone").value = user.phone || placeholder;
      document.getElementById("viewAddress").value = user.adress || placeholder;
      setFormReadOnly(true);
      // Show the modal
      const userModal = new bootstrap.Modal(document.getElementById("viewUserModal"));
      userModal.show();
    })
    .catch((error) => {
      console.error("Error fetching user:", error);
      alert(t("error_loading_user_details") + ": " + error.message);
    });
}

// Function to close the view user modal
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
      const idField = document.getElementById("viewUserId");
      idField.value = user.id;
      idField.readOnly = true;
      idField.disabled = true;
      idField.classList.add('bg-light'); // Add a visual indication that it's disabled
      
      document.getElementById("viewUsername").value = user.username;
      document.getElementById("viewEmail").value = user.email;
      document.getElementById("viewRole").value = user.role || "customer";
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
  if (!confirm(t("confirm_delete_user"))) return;

  fetch(`/api/users/${userId}`, { method: "DELETE" })
    .then((response) => {
      if (!response.ok) throw new Error(t("failed_to_delete_user"));
      return response.json();
    })
    .then((data) => {
      if (data.success) {
        alert(t("user_deleted_successfully"));
        fetchUsers(currentPage);
      } else {
        throw new Error(data.message || t("failed_to_delete_user"));
      }
    })
    .catch((error) => {
      console.error("Error deleting user:", error);
      alert(t("error_deleting_user") + ": " + error.message);
    });
}

// Function to toggle user lock status
function toggleUserLock(userId) {
  fetch(`/api/users/${userId}/toggle-lock`, { method: "POST" })
    .then((response) => {
      if (!response.ok) throw new Error(t("failed_to_toggle_user_lock"));
      return response.json();
    })
    .then((data) => {
      if (data.success) {
        fetchUsers(currentPage);
      } else {
        throw new Error(data.message || t("failed_to_toggle_user_lock"));
      }
    })
    .catch((error) => {
      console.error("Error toggling user lock:", error);
      alert(t("error_toggling_user_lock") + ": " + error.message);
    });
}

// Function to save user changes
function saveUserFromModal(event) {
  event.preventDefault();
  const userId = document.getElementById("viewUserId").value;
  const userData = {
    username: document.getElementById("viewUsername").value,
    email: document.getElementById("viewEmail").value,
    role: document.getElementById("viewRole").value,
    name: document.getElementById("viewName").value,
    phone: document.getElementById("viewPhone").value,
    adress: document.getElementById("viewAddress").value,
  };

  fetch(`/api/users/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userData),
  })
    .then((response) => {
      if (!response.ok) throw new Error(t("failed_to_update_user"));
      return response.json();
    })
    .then((data) => {
      if (data.success) {
        alert(t("user_updated_successfully"));
        const modal = bootstrap.Modal.getInstance(document.getElementById("viewUserModal"));
        modal.hide();
        fetchUsers(currentPage);
      } else {
        throw new Error(data.message || t("failed_to_update_user"));
      }
    })
    .catch((error) => {
      console.error("Error updating user:", error);
      alert(t("error_updating_user") + ": " + error.message);
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

let changelogTimeout;
let currentPageChangeLog = 1;

function debouncedFetchChangelog() {
  clearTimeout(changelogTimeout);
  changelogTimeout = setTimeout(() => fetchChangelog(1), 300); // Reset to page 1 on search
}

async function fetchChangelog(page = 1) {
  currentPageChangeLog = page;
  const search = document.getElementById("logSearch").value.trim();
  const sortField = document.getElementById("logSortField").value;
  const sortOrder = document.getElementById("logSortOrder").value;
  const limit = document.getElementById("logLimit").value;
  try {
    const res = await fetch(
      `/api/changelog?search=${encodeURIComponent(search)}&sort=${sortField}&order=${sortOrder}&page=${page}&limit=${limit}`,
    );

    const result = await res.json();

    if (!result.success || !Array.isArray(result.data)) {
      throw new Error("Invalid data format from server");
    }

    const data = result.data;
    const pagination = result.pagination;
    const tbody = document.getElementById("changelogTableBody");
    tbody.innerHTML = "";

    if (data.length === 0) {
      const row = document.createElement("tr");
      row.innerHTML = `<td colspan="7">${t("no_results_found")}</td>`;
      tbody.appendChild(row);
    } else {
      data.forEach((entry) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${entry.id}</td>
          <td>${entry.userId}</td>
          <td>${entry.field}</td>
          <td>${entry.changedAt}</td>
          <td>${entry.users_Changelog_changedByTousers?.username || "N/A"}</td>
          <td>${entry.oldValue}</td>
          <td>${entry.newValue}</td>
        `;
        tbody.appendChild(row);
      });
    }

    renderPagination(pagination.totalPages, pagination.page);
  } catch (err) {
    console.error("Error loading changelog:", err);
  }
}

function renderPagination(totalPages, currentPage) {
  const paginationContainer = document.getElementById("changelogPagination");
  paginationContainer.innerHTML = "";

  const paginationWrapper = document.createElement("div");
  paginationWrapper.className = "d-flex align-items-center gap-3";

  // Previous button
  const prevButton = document.createElement("button");
  prevButton.textContent = t("previous");
  prevButton.className = "btn btn-outline-primary";
  prevButton.disabled = currentPage === 1;
  prevButton.onclick = () => fetchChangelog(currentPage - 1);
  paginationWrapper.appendChild(prevButton);

  // Page numbers
  const pagesWrapper = document.createElement("div");
  pagesWrapper.className = "d-flex align-items-center gap-2";

  // Calculate range of pages to show
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + 4);
  if (endPage - startPage < 4) {
    startPage = Math.max(1, endPage - 4);
  }

  // First page
  if (startPage > 1) {
    const firstPageBtn = document.createElement("button");
    firstPageBtn.textContent = "1";
    firstPageBtn.className = `btn btn-outline-primary${currentPage === 1 ? " active" : ""}`;
    firstPageBtn.onclick = () => fetchChangelog(1);
    pagesWrapper.appendChild(firstPageBtn);

    if (startPage > 2) {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      ellipsis.className = "px-2";
      pagesWrapper.appendChild(ellipsis);
    }
  }

  // Page numbers
  for (let i = startPage; i <= endPage; i++) {
    const pageBtn = document.createElement("button");
    pageBtn.textContent = i;
    pageBtn.className = `btn btn-outline-primary${currentPage === i ? " active" : ""}`;
    pageBtn.onclick = () => fetchChangelog(i);
    pagesWrapper.appendChild(pageBtn);
  }

  // Last page
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      ellipsis.className = "px-2";
      pagesWrapper.appendChild(ellipsis);
    }

    const lastPageBtn = document.createElement("button");
    lastPageBtn.textContent = totalPages;
    lastPageBtn.className = `btn btn-outline-primary${currentPage === totalPages ? " active" : ""}`;
    lastPageBtn.onclick = () => fetchChangelog(totalPages);
    pagesWrapper.appendChild(lastPageBtn);
  }

  paginationWrapper.appendChild(pagesWrapper);

  // Next button
  const nextButton = document.createElement("button");
  nextButton.textContent = t("next");
  nextButton.className = "btn btn-outline-primary";
  nextButton.disabled = currentPage >= totalPages;
  nextButton.onclick = () => fetchChangelog(currentPage + 1);
  paginationWrapper.appendChild(nextButton);

  paginationContainer.appendChild(paginationWrapper);
}

// Optional: fetch once on load
document.addEventListener("DOMContentLoaded", fetchChangelog);

// Service Prices Management Functions
let services = [];

// Function to fetch services
async function fetchServices() {
  try {
    const response = await fetch('/api/services');
    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      } else if (response.status === 403) {
        alert(t('access_denied_admin'));
        return;
      }
      const data = await response.json();
      throw new Error(data.message || t('failed_to_fetch_services'));
    }
    const data = await response.json();
    if (data.success) {
      services = data.services;
      updateServicePricesTable();
    } else {
      throw new Error(data.message || t('failed_to_fetch_services'));
    }
  } catch (error) {
    console.error('Error fetching services:', error);
    alert(t('error_loading_services') + ': ' + error.message);
  }
}

// Function to update service prices table
function updateServicePricesTable() {
  const tableBody = document.getElementById('servicePricesTableBody');
  tableBody.innerHTML = '';

  if (!services || services.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = `<td colspan="5" class="text-center">${t('no_services_found')}</td>`;
    tableBody.appendChild(row);
    return;
  }

  services.forEach(service => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${service.id}</td>
      <td>${service.name}</td>
      <td>${service.description || '—'}</td>
      <td>
        <div class="input-group">
          <input type="number" class="form-control form-control-sm" 
                 value="${service.price}" 
                 min="0" 
                 step="0.01"
                 style="max-width: 100px;"
                 onchange="updateServicePrice(${service.id}, this.value)">
          <span class="input-group-text">$</span>
        </div>
      </td>
      <td>
        <button class="btn btn-sm btn-outline-primary me-1" onclick="editService(${service.id})">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteService(${service.id})">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

// Function to update service price
async function updateServicePrice(serviceId, newPrice) {
  try {
    const response = await fetch(`/api/services/${serviceId}/price`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ price: newPrice })
    });

    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      } else if (response.status === 403) {
        alert(t('access_denied_admin'));
        return;
      }
      const data = await response.json();
      throw new Error(data.message || t('failed_to_update_service_price'));
    }

    const data = await response.json();
    if (data.success) {
      // Update the local services array
      const serviceIndex = services.findIndex(s => s.id === serviceId);
      if (serviceIndex !== -1) {
        services[serviceIndex] = data.service;
      }
      alert(t('price_updated_successfully'));
    } else {
      throw new Error(data.message || t('failed_to_update_service_price'));
    }
  } catch (error) {
    console.error('Error updating service price:', error);
    alert(t('error_updating_price') + ': ' + error.message);
    // Refresh the table to show original values
    fetchServices();
  }
}

// Function to edit service details
async function editService(serviceId) {
  try {
    const service = services.find(s => s.id === serviceId);
    if (!service) {
      throw new Error(t('service_not_found'));
    }

    const newName = prompt(t('enter_new_service_name'), service.name);
    if (newName === null) return; // User cancelled

    const newDescription = prompt(t('enter_new_service_description'), service.description || '');
    if (newDescription === null) return; // User cancelled

    const newPrice = prompt(t('enter_new_service_price'), service.price);
    if (newPrice === null) return; // User cancelled

    const response = await fetch(`/api/services/${serviceId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: newName,
        description: newDescription,
        price: newPrice
      })
    });

    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      } else if (response.status === 403) {
        alert(t('access_denied_admin'));
        return;
      }
      const data = await response.json();
      throw new Error(data.message || t('failed_to_update_service'));
    }

    const data = await response.json();
    if (data.success) {
      // Update the local services array
      const serviceIndex = services.findIndex(s => s.id === serviceId);
      if (serviceIndex !== -1) {
        services[serviceIndex] = data.service;
      }
      updateServicePricesTable();
      alert(t('service_updated_successfully'));
    } else {
      throw new Error(data.message || t('failed_to_update_service'));
    }
  } catch (error) {
    console.error('Error updating service:', error);
    alert(t('error_updating_service') + ': ' + error.message);
  }
}

// Function to submit new service from modal
async function submitNewService(event) {
  event.preventDefault(); // Prevent form from submitting normally
  
  try {
    const name = document.getElementById('serviceName').value.trim();
    const description = document.getElementById('serviceDescription').value.trim();
    const price = document.getElementById('servicePrice').value;

    if (!name) {
      alert(t('service_name_required'));
      return;
    }

    if (!price || isNaN(parseFloat(price)) || parseFloat(price) < 0) {
      alert(t('invalid_price'));
      return;
    }

    const response = await fetch('/api/services', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        description,
        price: parseFloat(price)
      })
    });

    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      } else if (response.status === 403) {
        alert(t('access_denied_admin'));
        return;
      }
      const data = await response.json();
      throw new Error(data.message || t('failed_to_create_service'));
    }

    const data = await response.json();
    if (data.success) {
      // Add new service to the list and update table
      services.push(data.service);
      updateServicePricesTable();
      
      // Close modal and reset form
      const modal = bootstrap.Modal.getInstance(document.getElementById('addServiceModal'));
      modal.hide();
      document.getElementById('addServiceForm').reset();
      
      alert(t('service_created_successfully'));
    } else {
      throw new Error(data.message || t('failed_to_create_service'));
    }
  } catch (error) {
    console.error('Error creating service:', error);
    alert(t('error_creating_service') + ': ' + error.message);
  }
}

// Function to delete a service
async function deleteService(serviceId) {
  if (!confirm(t('confirm_delete_service'))) {
    return;
  }

  try {
    const response = await fetch(`/api/services/${serviceId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      } else if (response.status === 403) {
        alert(t('access_denied_admin'));
        return;
      } else if (response.status === 400 && data.message.includes('existing orders')) {
        alert(t('cannot_delete_service_with_orders'));
        return;
      }
      throw new Error(data.message || t('failed_to_delete_service'));
    }

    if (data.success) {
      services = services.filter(s => s.id !== serviceId);
      updateServicePricesTable();
      alert(t('service_deleted_successfully'));
    } else {
      throw new Error(data.message || t('failed_to_delete_service'));
    }
  } catch (error) {
    console.error('Error deleting service:', error);
    alert(t('error_deleting_service') + ': ' + error.message);
  }
}

// Call fetchServices when the page loads
document.addEventListener('DOMContentLoaded', () => {
  fetchUsers();
  fetchChangelog();
  fetchServices();
});
