// Get translation function from window object
const t = window.t || ((key) => key);

// Helper function to translate service names
function translateServiceName(serviceName) {
  if (!serviceName) return t('service_unknown');
  
  // Map service names to translation keys
  const serviceNameMap = {
    'Document Printing': 'service_document_printing',
    'Custom T-Shirt': 'service_custom_tshirt',
    'Unknown Service': 'service_unknown',
    'Logo Design': 'service_logo_design',
    'Branding': 'service_branding',
    'Social Media Graphics': 'service_social_media_graphics',
    'Print Materials': 'service_print_materials',
    'Graphic Design Consultation': 'service_graphic_design_consultation',
    'Custom merch design': 'service_custom_merch_design',
    'Custom Merch Design': 'service_custom_merch_design',
    'Photocopy': 'service_photocopy',
    'Printing': 'service_printing',
    'Merch Design': 'service_merch_design',
    'Xerox Copy Service': 'service_xerox_copy',
    'Merch': 'merch',
    'Grapic designer consultation': 'service_graphic_designer_consultation',
    'Graphic Designer Consultation': 'service_graphic_designer_consultation',
    'Unknown Product': 'service_unknown_product'
  };
  
  const translationKey = serviceNameMap[serviceName];
  return translationKey ? t(translationKey) : serviceName;
}

// Helper function to translate service descriptions
function translateServiceDescription(serviceName, originalDescription) {
  if (!serviceName) return originalDescription || '—';
  
  // Map service names to description translation keys
  const serviceDescriptionMap = {
    'Document Printing': 'service_description_document_printing',
    'Custom merch design': 'service_description_custom_merch_design',
    'Custom Merch Design': 'service_description_custom_merch_design',
    'Grapic designer consultation': 'service_description_graphic_designer_consultation',
    'Graphic Designer Consultation': 'service_description_graphic_designer_consultation',
    'Graphic Design Consultation': 'service_description_graphic_designer_consultation',
    'Unknown Product': 'service_description_unknown_product'
  };
  
  const translationKey = serviceDescriptionMap[serviceName];
  return translationKey ? t(translationKey) : (originalDescription || '—');
}

// Function to show message block
function showMessage(message, type = 'info', duration = 3000) {
  const messageBlock = document.getElementById('messageBlock');
  messageBlock.textContent = message;
  messageBlock.className = `message-block ${type}`;
  messageBlock.classList.add('show');

  // Hide message after duration
  setTimeout(() => {
    messageBlock.classList.remove('show');
  }, duration);
}

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
      showMessage(t("error_fetching_users") + ": " + error.message, 'error');
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
    row.innerHTML = `<td colspan="5" style="text-align: center;">${t("no_users_found")}</td>`;
    tableBody.appendChild(row);
    return;
  }

  users.forEach((user) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${user.username}</td>
      <td>${user.email}</td>
      <td>${t('role_' + user.role)}</td>
      <td>${user.is_locked ? t("locked") : t("active")}</td>
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

      // Store the user ID in the modal's dataset
      const modal = document.getElementById("viewUserModal");
      modal.dataset.userId = user.id;

      // Set basic user info
      document.getElementById("viewUsername").value = user.username || placeholder;
      document.getElementById("viewEmail").value = user.email || placeholder;
      document.getElementById("viewRole").value = user.role || "customer";

      // Set optional fields with fallback
      document.getElementById("viewName").value = user.name || placeholder;
      document.getElementById("viewPhone").value = user.phone || placeholder;
      document.getElementById("viewAddress").value = user.adress || placeholder;
      setFormReadOnly(true);
      // Show the modal
      const userModal = new bootstrap.Modal(modal);
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
      // Store the user ID in the modal's dataset
      const modal = document.getElementById("viewUserModal");
      modal.dataset.userId = user.id;
      
      // Populate the fields in the modal form
      document.getElementById("viewUsername").value = user.username;
      document.getElementById("viewEmail").value = user.email;
      document.getElementById("viewRole").value = user.role || "customer";
      document.getElementById("viewName").value = user.name || ""; // Set 'name' if available
      document.getElementById("viewPhone").value = user.phone || ""; // Set 'phone' if available
      document.getElementById("viewAddress").value = user.address || ""; // Set 'address' if available
      setFormReadOnly(false);
      // Show the modal
      const userModal = new bootstrap.Modal(modal);
      userModal.show();
    })
    .catch((error) => {
      console.error("Error fetching user:", error);
      alert("Error loading user for viewing: " + error.message);
    });
}

// Function to delete user
function deleteUser(userId) {
  const deleteUserModal = new bootstrap.Modal(document.getElementById('deleteUserModal'));
  const successModal = new bootstrap.Modal(document.getElementById('successModal'));
  const errorModal = new bootstrap.Modal(document.getElementById('errorModal'));

  // Store the user ID in the confirm button's dataset
  document.getElementById('confirmDeleteBtn').dataset.userId = userId;
  deleteUserModal.show();
}

// Add event listener for delete confirmation
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('confirmDeleteBtn').addEventListener('click', async function() {
    const userId = this.dataset.userId;
    const deleteUserModal = bootstrap.Modal.getInstance(document.getElementById('deleteUserModal'));
    const successModal = new bootstrap.Modal(document.getElementById('successModal'));
    const errorModal = new bootstrap.Modal(document.getElementById('errorModal'));

    try {
      const response = await fetch(`/api/users/${userId}`, { 
        method: "DELETE",
        headers: {
          'Accept': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 404) {
          throw new Error(t('user_not_found'));
        } else if (response.status === 403) {
          throw new Error(t('access_denied_admin'));
        } else if (response.status === 400 && data.message && data.message.includes('existing orders')) {
          throw new Error(t('cannot_delete_user_with_orders'));
        } else {
          throw new Error(data.message || t('failed_to_delete_user'));
        }
      }
      
      if (data.success) {
        deleteUserModal.hide();
        document.getElementById('successModalMessage').textContent = t('user_deleted_successfully');
        successModal.show();
        fetchUsers(currentPage);
      } else {
        throw new Error(data.message || t('failed_to_delete_user'));
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      deleteUserModal.hide();
      document.getElementById('errorModalMessage').textContent = error.message;
      errorModal.show();
    }
  });
});

// Function to toggle user lock status
function toggleUserLock(userId) {
  fetch(`/api/users/${userId}/toggle-lock`, { method: "POST" })
    .then((response) => {
      if (!response.ok) throw new Error(t("failed_to_toggle_user_lock"));
      return response.json();
    })
    .then((data) => {
      if (data.success) {
        // Use the translated message from the backend
        showMessage(data.message, 'success');
        fetchUsers(currentPage);
      } else {
        throw new Error(data.message || t("failed_to_toggle_user_lock"));
      }
    })
    .catch((error) => {
      console.error("Error toggling user lock:", error);
      showMessage(t("error_toggling_user_lock") + ": " + error.message, 'error');
    });
}

// Function to save user changes
function saveUserFromModal(event) {
  event.preventDefault();
  const modal = document.getElementById("viewUserModal");
  const userId = modal.dataset.userId;
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
        showMessage(t("user_updated_successfully"), 'success');
        const modal = bootstrap.Modal.getInstance(document.getElementById("viewUserModal"));
        modal.hide();
        fetchUsers(currentPage);
      } else {
        throw new Error(data.message || t("failed_to_update_user"));
      }
    })
    .catch((error) => {
      console.error("Error updating user:", error);
      showMessage(t("error_updating_user") + ": " + error.message, 'error');
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
      row.innerHTML = `<td colspan="6">${t("no_results_found")}</td>`;
      tbody.appendChild(row);
    } else {
      data.forEach((entry) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${entry.users_Changelog_userIdTousers?.username || t('unknown_user')}</td>
          <td>${entry.field}</td>
          <td>${entry.changedAt}</td>
          <td>${entry.users_Changelog_changedByTousers?.username || t('unknown_user')}</td>
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
        showMessage(t('access_denied_admin'), 'error');
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
    showMessage(t('error_loading_services') + ': ' + error.message, 'error');
  }
}

// Function to update service prices table
function updateServicePricesTable() {
  const tableBody = document.getElementById('servicePricesTableBody');
  tableBody.innerHTML = '';

  if (!services || services.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = `<td colspan="4" class="text-center">${t('no_services_found')}</td>`;
    tableBody.appendChild(row);
    return;
  }

  services.forEach(service => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${translateServiceName(service.name)}</td>
      <td>${translateServiceDescription(service.name, service.description)}</td>
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
        showMessage(t('access_denied_admin'), 'error');
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
      showMessage(t('price_updated_successfully'), 'success');
    } else {
      throw new Error(data.message || t('failed_to_update_service_price'));
    }
  } catch (error) {
    console.error('Error updating service price:', error);
    showMessage(t('error_updating_price') + ': ' + error.message, 'error');
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

    // Populate the edit modal with current service data
    document.getElementById('editServiceName').value = service.name;
    document.getElementById('editServiceDescription').value = service.description || '';
    document.getElementById('editServicePrice').value = service.price;

    // Store the service ID in the modal's dataset
    const modal = document.getElementById('editServiceModal');
    modal.dataset.serviceId = serviceId;

    // Show the modal
    const editModal = new bootstrap.Modal(modal);
    editModal.show();
  } catch (error) {
    console.error('Error preparing service edit:', error);
    showMessage(t('error_preparing_service_edit') + ': ' + error.message, 'error');
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
      showMessage(t('service_name_required'), 'error');
      return;
    }

    if (!price || isNaN(parseFloat(price)) || parseFloat(price) < 0) {
      showMessage(t('invalid_price'), 'error');
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
        showMessage(t('access_denied_admin'), 'error');
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
      
      showMessage(t('service_created_successfully'), 'success');
    } else {
      throw new Error(data.message || t('failed_to_create_service'));
    }
  } catch (error) {
    console.error('Error creating service:', error);
    showMessage(t('error_creating_service') + ': ' + error.message, 'error');
  }
}

// Function to delete a service
async function deleteService(serviceId) {
  try {
    const service = services.find(s => s.id === serviceId);
    if (!service) {
      throw new Error(t('service_not_found'));
    }

    // Check if service has orders before showing confirmation
    const checkResponse = await fetch(`/api/services/${serviceId}/check-orders`);
    let orderCount = 0;
    let hasOrders = false;
    
    if (checkResponse.ok) {
      const checkData = await checkResponse.json();
      if (checkData.success) {
        orderCount = checkData.orderCount || 0;
        hasOrders = orderCount > 0;
      }
    }

    // Set the confirmation message
    let message = t('confirm_delete_service_message', { name: translateServiceName(service.name) });
    
    if (hasOrders) {
      // Use translation with parameters for multilingual support
      message = t('cannot_delete_service_with_orders_detailed', {
        serviceName: translateServiceName(service.name),
        orderCount: orderCount,
        orderPlural: orderCount > 1 ? t('orders') : t('order')
      });
      
      // Show error message and don't show delete modal
      showMessage(message, 'error');
      return;
    }

    document.getElementById('deleteServiceMessage').textContent = message;

    // Store the service ID in the modal's dataset
    const modal = document.getElementById('deleteServiceModal');
    modal.dataset.serviceId = serviceId;

    // Show the modal
    const deleteModal = new bootstrap.Modal(modal);
    deleteModal.show();
  } catch (error) {
    console.error('Error preparing service deletion:', error);
    showMessage(t('error_preparing_service_deletion') + ': ' + error.message, 'error');
  }
}

// Call fetchServices when the page loads
document.addEventListener('DOMContentLoaded', () => {
  fetchUsers();
  fetchChangelog();
  fetchServices();
  fetchOrderStatistics();

  // Add event listeners for service modals
  const saveEditServiceBtn = document.getElementById('saveEditServiceBtn');
  const confirmDeleteServiceBtn = document.getElementById('confirmDeleteServiceBtn');

  // Save edit service button
  saveEditServiceBtn?.addEventListener('click', async function() {
    const modal = document.getElementById('editServiceModal');
    const serviceId = modal.dataset.serviceId;
    
    try {
      const name = document.getElementById('editServiceName').value.trim();
      const description = document.getElementById('editServiceDescription').value.trim();
      const price = document.getElementById('editServicePrice').value;

      if (!name) {
        showMessage(t('service_name_required'), 'error');
        return;
      }

      if (!price || isNaN(parseFloat(price)) || parseFloat(price) < 0) {
        showMessage(t('invalid_price'), 'error');
        return;
      }

      const response = await fetch(`/api/services/${serviceId}`, {
        method: 'PUT',
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
          showMessage(t('access_denied_admin'), 'error');
          return;
        }
        const data = await response.json();
        throw new Error(data.message || t('failed_to_update_service'));
      }

      const data = await response.json();
      if (data.success) {
        // Update the local services array
        const serviceIndex = services.findIndex(s => s.id === parseInt(serviceId));
        if (serviceIndex !== -1) {
          services[serviceIndex] = data.service;
        }
        updateServicePricesTable();
        
        // Close modal
        const editModal = bootstrap.Modal.getInstance(modal);
        editModal.hide();
        
        showMessage(t('service_updated_successfully'), 'success');
      } else {
        throw new Error(data.message || t('failed_to_update_service'));
      }
    } catch (error) {
      console.error('Error updating service:', error);
      showMessage(t('error_updating_service') + ': ' + error.message, 'error');
    }
  });

  // Confirm delete service button
  confirmDeleteServiceBtn?.addEventListener('click', async function() {
    const modal = document.getElementById('deleteServiceModal');
    const serviceId = modal.dataset.serviceId;
    const deleteModal = bootstrap.Modal.getInstance(modal);
    
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
          showMessage(t('access_denied_admin'), 'error');
          return;
        } else if (response.status === 400) {
          // Handle specific error for existing orders - use server message directly
          // as it's already translated
          showMessage(data.message || t('failed_to_delete_service'), 'error');
          return;
        } else if (response.status === 404) {
          showMessage(t('service_not_found'), 'error');
          return;
        }
        throw new Error(data.message || t('failed_to_delete_service'));
      }

      if (data.success) {
        services = services.filter(s => s.id !== parseInt(serviceId));
        updateServicePricesTable();
        
        // Close modal
        deleteModal.hide();
        
        // Use server message directly as it's already translated
        showMessage(data.message || t('service_deleted_successfully'), 'success');
      } else {
        throw new Error(data.message || t('failed_to_delete_service'));
      }
    } catch (error) {
      console.error('Error deleting service:', error);
      showMessage(t('error_deleting_service') + ': ' + error.message, 'error');
    }
  });
});

// Order Statistics Functions
async function fetchOrderStatistics() {
  try {
    const period = document.getElementById('statisticsPeriod').value;
    const loadingIndicator = document.getElementById('statisticsLoadingIndicator');
    const overallCards = document.getElementById('overallStatisticsCards');
    const tableBody = document.getElementById('orderStatisticsTableBody');

    // Show loading indicator
    loadingIndicator.style.display = 'block';
    overallCards.innerHTML = '';
    tableBody.innerHTML = '';

    const response = await fetch(`/api/order-statistics?period=${period}`);
    
    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      } else if (response.status === 403) {
        showMessage(t('access_denied_admin'), 'error');
        return;
      }
      const data = await response.json();
      throw new Error(data.message || t('error_fetching_order_statistics'));
    }

    const data = await response.json();
    
    if (data.success) {
      updateOrderStatisticsDisplay(data.data);
      showMessage(t('order_statistics_fetched_successfully'), 'success');
    } else {
      throw new Error(data.message || t('error_fetching_order_statistics'));
    }
  } catch (error) {
    console.error('Error fetching order statistics:', error);
    showMessage(t('error_fetching_order_statistics') + ': ' + error.message, 'error');
  } finally {
    document.getElementById('statisticsLoadingIndicator').style.display = 'none';
  }
}

function updateOrderStatisticsDisplay(data) {
  const { service_statistics, overall_statistics } = data;
  
  // Update overall statistics cards
  updateOverallStatisticsCards(overall_statistics);
  
  // Update service statistics table
  updateServiceStatisticsTable(service_statistics, overall_statistics.total_revenue);
}

function updateOverallStatisticsCards(overallStats) {
  const cardsContainer = document.getElementById('overallStatisticsCards');
  
  cardsContainer.innerHTML = `
    <div class="col-md-4">
      <div class="card text-center">
        <div class="card-body">
          <h5 class="card-title">${t('total_orders')}</h5>
          <h2 class="text-primary">${overallStats.total_orders}</h2>
        </div>
      </div>
    </div>
    <div class="col-md-4">
      <div class="card text-center">
        <div class="card-body">
          <h5 class="card-title">${t('total_revenue')}</h5>
          <h2 class="text-success">$${overallStats.total_revenue.toFixed(2)}</h2>
        </div>
      </div>
    </div>
    <div class="col-md-4">
      <div class="card text-center">
        <div class="card-body">
          <h5 class="card-title">${t('average_order_value')}</h5>
          <h2 class="text-info">$${overallStats.average_order_value.toFixed(2)}</h2>
        </div>
      </div>
    </div>
  `;
}

function updateServiceStatisticsTable(serviceStats, totalRevenue) {
  const tableBody = document.getElementById('orderStatisticsTableBody');
  
  if (!serviceStats || serviceStats.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center">${t('no_services_found')}</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = serviceStats.map(stat => {
    const percentage = totalRevenue > 0 ? ((stat.total_revenue / totalRevenue) * 100).toFixed(1) : '0.0';
    
    return `
      <tr>
        <td>${translateServiceName(stat.service_name)}</td>
        <td>${stat.order_count}</td>
        <td>${stat.total_quantity}</td>
        <td>$${stat.total_revenue.toFixed(2)}</td>
        <td>$${stat.average_order_value.toFixed(2)}</td>
        <td>${percentage}%</td>
      </tr>
    `;
  }).join('');
}
