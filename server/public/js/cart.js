// Cart management functions
const cart = {
  async getContents() {
    try {
      const response = await fetch('/api/cart', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      return await response.json();
    } catch (error) {
      console.error('Error fetching cart:', error);
      this.showError('Failed to fetch cart contents');
      return null;
    }
  },

  async addItem(serviceId, quantity = 1, options = {}) {
    try {
      const response = await fetch('/api/cart/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          service_id: serviceId,
          quantity,
          options
        })
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || 'Failed to add item');
      }
      this.updateCartUI(result);
      this.showSuccess('Item added to cart');
      return result;
    } catch (error) {
      console.error('Error adding item to cart:', error);
      this.showError('Failed to add item to cart');
      return null;
    }
  },

  async updateQuantity(index, quantity) {
    try {
      console.log('=== Cart.js Quantity Update Debug ===');
      console.log('Index:', index);
      console.log('Requested Quantity:', quantity);
      
      // Get current item quantity
      const itemElement = document.querySelector(`[data-index="${index}"]`);
      console.log('Item Element:', itemElement);
      
      const currentQuantity = itemElement ? parseInt(itemElement.querySelector('.quantity-display').dataset.quantity) : 0;
      console.log('Current Quantity from Dataset:', currentQuantity);

      // Validate quantity - ensure it's a positive number
      if (isNaN(quantity) || quantity <= 0) {
        console.log('Validation Failed: Invalid Quantity');
        console.log('Is NaN:', isNaN(quantity));
        console.log('Is <= 0:', quantity <= 0);
        
        this.showError(t('invalid_quantity'));
        // Reset the quantity display to the current valid quantity
        if (itemElement) {
          const quantityDisplay = itemElement.querySelector('.quantity-display');
          console.log('Quantity Display Element:', quantityDisplay);
          if (quantityDisplay) {
            console.log('Resetting to current quantity:', currentQuantity);
            quantityDisplay.textContent = currentQuantity;
          }
        }
        return null;
      }

      console.log('Validation Passed: Proceeding with API call');

      // Show loading state for the specific item
      if (itemElement) {
        itemElement.style.opacity = '0.5';
        itemElement.style.pointerEvents = 'none';
      }

      const response = await fetch('/api/cart/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          index,
          quantity
        })
      });
      console.log('API Response Status:', response.status);
      
      const result = await response.json();
      console.log('API Response:', result);
      
      if (!result.success) {
        console.log('API Call Failed:', result.message);
        throw new Error(result.message || t('failed_to_update_quantity'));
      }
      
      console.log('Update Successful, Updating UI');
      this.updateCartUI(result);
      return result;
    } catch (error) {
      console.error('Error updating cart item:', error);
      this.showError(t('error_updating_quantity'));
      // Reset the quantity display to the current valid quantity
      const itemElement = document.querySelector(`[data-index="${index}"]`);
      if (itemElement) {
        const quantityDisplay = itemElement.querySelector('.quantity-display');
        if (quantityDisplay) {
          console.log('Error Recovery: Resetting to dataset quantity:', quantityDisplay.dataset.quantity);
          quantityDisplay.textContent = quantityDisplay.dataset.quantity;
        }
      }
      return null;
    } finally {
      // Remove loading state
      const itemElement = document.querySelector(`[data-index="${index}"]`);
      if (itemElement) {
        itemElement.style.opacity = '1';
        itemElement.style.pointerEvents = 'auto';
      }
    }
  },

  async removeItem(index) {
    try {
      // Show loading state for the specific item
      const itemElement = document.querySelector(`[data-index="${index}"]`);
      if (itemElement) {
        itemElement.style.opacity = '0.5';
        itemElement.style.pointerEvents = 'none';
      }

      const response = await fetch('/api/cart/remove', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ index })
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || 'Failed to remove item');
      }
      
      // Animate item removal
      if (itemElement) {
        itemElement.style.transition = 'all 0.3s ease';
        itemElement.style.height = '0';
        itemElement.style.opacity = '0';
        setTimeout(() => {
          this.updateCartUI(result);
        }, 300);
      } else {
        this.updateCartUI(result);
      }
      
      this.showSuccess('Item removed from cart');
      return result;
    } catch (error) {
      console.error('Error removing item from cart:', error);
      this.showError('Failed to remove item');
      return null;
    }
  },

  async clearCart() {
    if (!confirm('Are you sure you want to clear your cart?')) {
      return;
    }

    try {
      const response = await fetch('/api/cart/clear', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || 'Failed to clear cart');
      }
      this.updateCartUI(result);
      this.showSuccess('Cart cleared');
      return result;
    } catch (error) {
      console.error('Error clearing cart:', error);
      this.showError('Failed to clear cart');
      return null;
    }
  },

  updateCartUI(cartData) {
    // Update cart count in header
    const cartCountElement = document.getElementById('cart-count');
    if (cartCountElement) {
      cartCountElement.textContent = cartData.itemCount || 0;
    }

    // Update cart items list if on cart page
    const cartItemsContainer = document.getElementById('cart-items');
    if (cartItemsContainer && cartData.cart) {
      if (cartData.cart.length === 0) {
        cartItemsContainer.innerHTML = '<div class="cart-empty">Your cart is empty</div>';
      } else {
        cartItemsContainer.innerHTML = cartData.cart.map((item, index) => `
          <div class="cart-item" data-index="${index}">
            <div class="item-details">
              <h3>${item.name}</h3>
              <p>${item.service_description || ''}</p>
              ${Object.entries(item.options || {}).map(([key, value]) => `
                <span class="option-tag">${key}: ${value}</span>
              `).join('')}
            </div>
            <div class="item-quantity">
              <button onclick="cart.updateQuantity(${index}, ${item.quantity - 1})" class="quantity-btn" ${item.quantity <= 1 ? 'disabled' : ''}>-</button>
              <span class="quantity-display">${item.quantity}</span>
              <button onclick="cart.updateQuantity(${index}, ${item.quantity + 1})" class="quantity-btn">+</button>
            </div>
            <div class="item-price">
              <p>Price: $${(item.price * item.quantity).toFixed(2)}</p>
              <button onclick="cart.removeItem(${index})" class="remove-btn">Remove</button>
            </div>
          </div>
        `).join('');
      }

      // Update cart total
      const cartTotalElement = document.getElementById('cart-total');
      if (cartTotalElement) {
        cartTotalElement.textContent = `$${cartData.cartTotal.toFixed(2)}`;
      }

      // Update checkout button visibility
      const checkoutBtn = document.querySelector('.checkout-btn');
      if (checkoutBtn) {
        checkoutBtn.style.display = cartData.cart.length > 0 ? 'block' : 'none';
      }
    }
  },

  showError(message) {
    // You can implement a toast or alert system here
    alert(message);
  },

  showSuccess(message) {
    // You can implement a toast or alert system here
    // For now, we'll just log to console
    console.log(message);
  }
};

// Initialize cart on page load
document.addEventListener('DOMContentLoaded', async () => {
  const cartData = await cart.getContents();
  if (cartData) {
    cart.updateCartUI(cartData);
  }
}); 