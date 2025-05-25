// Format date according to locale
function formatDate(dateString, locale) {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString;
  }
}

// Format price helper function
function formatPrice(price) {
  if (typeof price === 'string') {
    price = parseFloat(price);
  }
  return typeof price === 'number' && !isNaN(price) ? price.toFixed(2) : '0.00';
}

// Status color helpers
function getStatusColor(status) {
  const statusColors = {
    'Pending': 'warning',
    'Processing': 'info',
    'Completed': 'success',
    'Cancelled': 'danger'
  };
  return statusColors[status] || 'secondary';
}

function getPaymentStatusColor(status) {
  const statusColors = {
    'completed': 'success',
    'pending': 'warning',
    'failed': 'danger'
  };
  return statusColors[status] || 'secondary';
}

function getTranslatedStatus(status) {
  const statusMap = {
    'Pending': profileData.translations.status_pending,
    'Processing': profileData.translations.status_processing,
    'Completed': profileData.translations.status_completed,
    'Cancelled': profileData.translations.status_cancelled
  };
  return statusMap[status] || status;
}

function getTranslatedPaymentStatus(status) {
  const statusMap = {
    'completed': profileData.translations.payment_status_completed,
    'pending': profileData.translations.payment_status_pending,
    'failed': profileData.translations.payment_status_failed
  };
  return statusMap[status] || status;
}

// Show status message helper
function showStatusMessage(message, isSuccess = true) {
  const statusDiv = document.getElementById("statusMessage");
  statusDiv.classList.remove("d-none", "alert-success", "alert-danger");
  statusDiv.classList.add(isSuccess ? "alert-success" : "alert-danger");
  statusDiv.textContent = message;
  
  // Hide the message after 5 seconds
  setTimeout(() => {
    statusDiv.classList.add("d-none");
  }, 5000);
}

// Form validation helpers
function validateInput(input) {
  const isValid = input.checkValidity();
  const feedback = input.nextElementSibling;
  
  if (!isValid) {
    input.classList.add('is-invalid');
    feedback.textContent = input.title;
    feedback.style.display = 'block';
  } else {
    input.classList.remove('is-invalid');
    feedback.style.display = 'none';
  }
  
  return isValid;
}

function validateForm(form) {
  const inputs = form.querySelectorAll('.editable-input:not([readonly])');
  let isValid = true;
  
  inputs.forEach(input => {
    if (!validateInput(input)) {
      isValid = false;
    }
  });
  
  return isValid;
}

// Profile form functionality
function initializeProfileForm() {
  const form = document.getElementById("profileForm");
  let originalValues = {};

  function enableEdit() {
    const inputs = document.querySelectorAll(".editable-input");
    originalValues = {};

    inputs.forEach(input => {
      originalValues[input.name] = input.value;
      input.removeAttribute("readonly");
    });

    document.getElementById("editBtn").classList.add("d-none");
    document.getElementById("saveBtn").classList.remove("d-none");
    document.getElementById("cancelBtn").classList.remove("d-none");
  }

  function cancelEdit() {
    const inputs = document.querySelectorAll(".editable-input");

    inputs.forEach(input => {
      input.value = originalValues[input.name];
      input.setAttribute("readonly", true);
      input.classList.remove('is-invalid');
      input.nextElementSibling.style.display = 'none';
    });

    document.getElementById("editBtn").classList.remove("d-none");
    document.getElementById("saveBtn").classList.add("d-none");
    document.getElementById("cancelBtn").classList.add("d-none");
  }

  // Add validation on input
  form.querySelectorAll('.editable-input').forEach(input => {
    input.addEventListener('input', () => validateInput(input));
  });

  // Form submission handler
  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    if (!validateForm(form)) {
      showStatusMessage(profileData.translations.validation_error, false);
      return;
    }

    const formData = new FormData(form);

    try {
      const response = await fetch("/api/users", {
        method: "PUT",
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        // Update userData with new values
        Object.assign(profileData.userData, Object.fromEntries(formData));
        showStatusMessage("Profile updated successfully!", true);
        setTimeout(() => location.reload(), 1500);
      } else {
        // Handle specific validation errors
        if (result.error === 'email_exists') {
          showStatusMessage(profileData.translations.email_exists, false);
        } else if (result.error === 'invalid_email') {
          showStatusMessage(profileData.translations.invalid_email, false);
        } else if (result.error === 'invalid_phone') {
          showStatusMessage(profileData.translations.invalid_phone, false);
        } else if (result.error === 'invalid_address') {
          showStatusMessage(profileData.translations.invalid_address, false);
        } else {
          showStatusMessage(result.error || "An error occurred.", false);
        }
      }
    } catch (error) {
      console.error("Error:", error);
      showStatusMessage("An error occurred while updating your profile.", false);
    }
  });

  // Initialize event listeners
  document.getElementById("editBtn").addEventListener("click", enableEdit);
  document.getElementById("cancelBtn").addEventListener("click", cancelEdit);
}

// Avatar upload functionality
function initializeAvatarUpload() {
  document.getElementById('uploadAvatarBtn').addEventListener('click', async function() {
    const fileInput = document.getElementById('avatar');
    const file = fileInput.files[0];
    const progressBar = document.getElementById('avatarUploadProgress');
    const progressBarInner = progressBar.querySelector('.progress-bar');
    
    if (!file) {
      showStatusMessage('Please select a file first', false);
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      progressBar.classList.remove('d-none');
      progressBarInner.style.width = '0%';

      const response = await fetch('/upload-avatar', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned unexpected response');
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Upload failed');
      }

      progressBarInner.style.width = '100%';
      showStatusMessage('Avatar updated successfully! Page will refresh in 2 seconds...', true);
      setTimeout(() => {
        location.reload();
      }, 2000);
      
    } catch (error) {
      progressBar.classList.add('d-none');
      showStatusMessage(error.message || 'Avatar upload failed', false);
      console.error('Upload error:', error);
    }
  });
}

// Cart functionality
async function loadCartData() {
  try {
    const response = await fetch('/api/cart/data');
    const data = await response.json();
    
    // Update messages
    const messagesDiv = document.getElementById('cartMessages');
    messagesDiv.innerHTML = '';
    
    if (data.error) {
      messagesDiv.innerHTML = `
        <div class="alert alert-danger mt-3">
          ${data.error}
        </div>
      `;
    }
    
    if (data.success) {
      messagesDiv.innerHTML = `
        <div class="alert alert-success mt-3">
          ${data.success}
        </div>
      `;
    }

    // Update cart content
    const cartContentDiv = document.getElementById('cartContent');
    
    if (!data.cart || data.cart.length === 0) {
      cartContentDiv.innerHTML = `
        <div class="text-center mt-4">
          <p class="mb-3">${profileData.translations.your_cart_is_empty}</p>
          <a href="/" class="btn">${profileData.translations.browse_services}</a>
        </div>
      `;
      return;
    }

    // Render cart items...
    // (Cart rendering code remains the same but uses profileData.translations)
  } catch (error) {
    console.error('Error loading cart:', error);
    document.getElementById('cartContent').innerHTML = `
      <div class="alert alert-danger mt-3">
        ${profileData.translations.error_loading_cart}
      </div>
    `;
  }
}

// Orders functionality
async function loadOrdersData() {
  try {
    const response = await fetch('/checkout/user-orders');
    const data = await response.json();
    
    const ordersContentDiv = document.getElementById('ordersContent');
    
    if (!data.success) {
      ordersContentDiv.innerHTML = `
        <div class="alert alert-danger mt-3">
          ${data.error || profileData.translations.error_loading_orders}
        </div>
      `;
      return;
    }

    if (!data.orders || data.orders.length === 0) {
      ordersContentDiv.innerHTML = `
        <div class="text-center mt-4">
          <p class="mb-3">${profileData.translations.no_orders_yet}</p>
          <a href="/" class="btn">${profileData.translations.browse_services}</a>
        </div>
      `;
      return;
    }

    // Render orders...
    // (Orders rendering code remains the same but uses profileData.translations)
  } catch (error) {
    console.error('Error loading orders:', error);
    document.getElementById('ordersContent').innerHTML = `
      <div class="alert alert-danger mt-3">
        ${profileData.translations.error_loading_orders}
      </div>
    `;
  }
}

// Initialize everything when DOM is loaded
document.addEventListener("DOMContentLoaded", function() {
  // Format joined date
  const joinedDateElement = document.getElementById('joinedDate');
  if (joinedDateElement) {
    const dateString = joinedDateElement.getAttribute('data-date');
    joinedDateElement.textContent = formatDate(dateString, profileData.locale);
  }

  // Initialize profile form
  initializeProfileForm();

  // Initialize avatar upload
  initializeAvatarUpload();

  // Handle tab switching
  const tabLinks = document.querySelectorAll('.nav-link');
  
  tabLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      if (this.getAttribute('href') === '#cart') {
        loadCartData();
      } else if (this.getAttribute('href') === '#orders') {
        loadOrdersData();
      }
    });
  });
  
  // Load appropriate data based on current hash
  const hash = window.location.hash;
  if (hash === '#cart') {
    loadCartData();
  } else if (hash === '#orders') {
    loadOrdersData();
  }
});