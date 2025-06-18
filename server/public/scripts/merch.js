document.addEventListener('DOMContentLoaded', function () {
    let tshirtModel = document.getElementById('tshirt-model');
    const textOverlay = document.getElementById('text-overlay');
    const textInput = document.getElementById('text-input');
    const textColorPicker = document.getElementById('text-color-picker');
    const fontSize = document.getElementById('font-size');
    const fontFamily = document.getElementById('font-family');
    const imageUpload = document.getElementById('image-upload');
    const customImage = document.getElementById('custom-image');
    const imageWrapper = document.getElementById('image-wrapper');
    const resizeHandle = imageWrapper.querySelector('.resize-handle');
    const tshirtSize = document.getElementById('tshirt-size');
    const addToCartBtn = document.getElementById('addToCartBtn');
    const unauthorizedMessage = document.getElementById('unauthorized-message');

    // Initialize positions
    textOverlay.style.left = '50%';
    textOverlay.style.top = '50%';
    imageWrapper.style.left = '50%';
    imageWrapper.style.top = '20%';

    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let activeElement = null;

    // Change text content
    textInput.addEventListener('input', function () {
        textOverlay.textContent = this.value || 'Your Text Here';
    });

    // Change text color
    textColorPicker.addEventListener('input', function () {
        textOverlay.style.color = this.value;
    });

    // Change font size
    fontSize.addEventListener('input', function () {
        textOverlay.style.fontSize = this.value + 'px';
    });

    // Change font family
    fontFamily.addEventListener('change', function () {
        textOverlay.style.fontFamily = this.value;
    });

    // Initialize font family
    textOverlay.style.fontFamily = fontFamily.value;

    // Upload custom image with authorization check
    imageUpload.addEventListener('change', async function (e) {
        try {
            // Check authorization first
            const response = await fetch('/api/cart/data');
            if (!response.ok) {
                // User is not logged in, show error message
                unauthorizedMessage.style.display = 'block';
                window.scrollTo({ top: 0, behavior: 'smooth' });
                // Clear the file input
                imageUpload.value = '';
                return;
            }

            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    customImage.src = e.target.result;
                    customImage.style.display = 'block';
                    // Reset image position when new image is uploaded
                    imageWrapper.style.left = '50%';
                    imageWrapper.style.top = '20%';
                };
                reader.readAsDataURL(file);
            }
        } catch (error) {
            console.error('Error:', error);
            unauthorizedMessage.style.display = 'block';
            window.scrollTo({ top: 0, behavior: 'smooth' });
            // Clear the file input
            imageUpload.value = '';
        }
    });

    // Drag functionality
    function dragStart(e) {
        if (e.target === textOverlay || e.target === imageWrapper) {
            activeElement = e.target;
            isDragging = true;
            activeElement.classList.add('dragging');

            const rect = activeElement.getBoundingClientRect();
            const tshirtRect = tshirtModel.getBoundingClientRect();

            if (e.type === "touchstart") {
                initialX = e.touches[0].clientX - rect.left + tshirtRect.left;
                initialY = e.touches[0].clientY - rect.top + tshirtRect.top;
            } else {
                initialX = e.clientX - rect.left + tshirtRect.left;
                initialY = e.clientY - rect.top + tshirtRect.top;
            }
        }
    }

    function dragEnd(e) {
        if (activeElement) {
            isDragging = false;
            activeElement.classList.remove('dragging');
            activeElement = null;
        }
    }

    function drag(e) {
        if (isDragging && activeElement) {
            e.preventDefault();

            let clientX, clientY;
            if (e.type === "touchmove") {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
            }

            const tshirtRect = tshirtModel.getBoundingClientRect();
            const elementRect = activeElement.getBoundingClientRect();

            // Calculate new position relative to the t-shirt
            let newX = ((clientX - initialX) / tshirtRect.width) * 100;
            let newY = ((clientY - initialY) / tshirtRect.height) * 100;

            // Constrain movement within t-shirt boundaries with some padding
            newX = Math.min(Math.max(0, newX), 100);
            newY = Math.min(Math.max(0, newY), 100);

            // Update position using percentages
            activeElement.style.left = `${newX}%`;
            activeElement.style.top = `${newY}%`;
        }
    }

    // Event Listeners for both mouse and touch events
    textOverlay.addEventListener('mousedown', dragStart, false);
    imageWrapper.addEventListener('mousedown', dragStart, false);
    document.addEventListener('mousemove', drag, false);
    document.addEventListener('mouseup', dragEnd, false);

    textOverlay.addEventListener('touchstart', dragStart, false);
    imageWrapper.addEventListener('touchstart', dragStart, false);
    document.addEventListener('touchmove', drag, false);
    document.addEventListener('touchend', dragEnd, false);

    // Prevent default drag behavior
    textOverlay.addEventListener('dragstart', (e) => e.preventDefault());
    imageWrapper.addEventListener('dragstart', (e) => e.preventDefault());

    // Make image resizable
    let isResizing = false;
    let initialWidth;
    let initialHeight;

    resizeHandle.addEventListener('mousedown', function (e) {
        isResizing = true;
        e.preventDefault();
        initialWidth = customImage.offsetWidth;
        initialHeight = customImage.offsetHeight;
    });

    document.addEventListener('mousemove', function (e) {
        if (isResizing) {
            const tshirtRect = tshirtModel.getBoundingClientRect();
            const newWidth = Math.min(
                Math.max(50, e.clientX - imageWrapper.getBoundingClientRect().left),
                tshirtRect.width * 0.9
            );
            const aspectRatio = initialHeight / initialWidth;
            const newHeight = newWidth * aspectRatio;

            customImage.style.width = `${newWidth}px`;
            customImage.style.height = `${newHeight}px`;
        }
    });

    document.addEventListener('mouseup', function () {
        isResizing = false;
    });

    // Function to update T-shirt size
    function updateTshirtSize(size) {
        switch (size) {
            case 'small':
                tshirtModel.style.width = '250px';
                tshirtModel.style.height = '350px';
                break;
            case 'medium':
                tshirtModel.style.width = '300px';
                tshirtModel.style.height = '400px';
                break;
            case 'large':
                tshirtModel.style.width = '350px';
                tshirtModel.style.height = '450px';
                break;
            case 'xl':
                tshirtModel.style.width = '400px';
                tshirtModel.style.height = '500px';
                break;
        }
    }

    // Listen for size selection changes
    tshirtSize.addEventListener('change', function () {
        updateTshirtSize(this.value);
    });

    // Initialize default size
    updateTshirtSize(tshirtSize.value);

    async function captureDesign() {
        // Create a canvas element
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Set canvas size to match t-shirt model
        const tshirtRect = tshirtModel.getBoundingClientRect();
        canvas.width = tshirtRect.width;
        canvas.height = tshirtRect.height;

        // Draw the t-shirt template
        const tshirtTemplate = tshirtModel.querySelector('.tshirt-template');
        ctx.drawImage(tshirtTemplate, 0, 0, canvas.width, canvas.height);

        // Draw the custom image if it exists
        if (customImage.style.display !== 'none') {
            const imageRect = imageWrapper.getBoundingClientRect();
            const relativeRect = {
                x: imageRect.left - tshirtRect.left,
                y: imageRect.top - tshirtRect.top,
                width: imageRect.width,
                height: imageRect.height
            };
            ctx.drawImage(customImage, relativeRect.x, relativeRect.y, relativeRect.width, relativeRect.height);
        }

        // Draw the text if it exists
        if (textOverlay.textContent.trim()) {
            const textRect = textOverlay.getBoundingClientRect();
            ctx.font = `${window.getComputedStyle(textOverlay).fontSize} ${fontFamily.value}`;
            ctx.fillStyle = textOverlay.style.color || '#000000';
            ctx.textAlign = 'center';
            ctx.fillText(
                textOverlay.textContent,
                textRect.left - tshirtRect.left + textRect.width / 2,
                textRect.top - tshirtRect.top + textRect.height / 2
            );
        }

        // Convert canvas to base64 image with compression
        return canvas.toDataURL('image/jpeg', 0.7); // Use JPEG format with 70% quality
    }

    async function addToCart() {
        try {
            // Disable the button to prevent multiple clicks
            addToCartBtn.disabled = true;
            addToCartBtn.textContent = 'Adding to cart...';

            // Check if user is logged in
            const authResponse = await fetch('/api/cart/data');
            if (!authResponse.ok) {
                unauthorizedMessage.style.display = 'block';
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }

            // Capture the design
            const designImage = await captureDesign();
            console.log('Design captured:', designImage.substring(0, 100) + '...');

            // Prepare design details
            const designDetails = {
                text: textOverlay.textContent.trim() || null,
                textColor: textColorPicker.value,
                fontSize: fontSize.value,
                fontFamily: fontFamily.value,
                position: {
                    x: parseFloat(textOverlay.style.left) || 50,
                    y: parseFloat(textOverlay.style.top) || 50
                },
                imagePosition: customImage.style.display !== 'none' ? {
                    x: parseFloat(imageWrapper.style.left) || 50,
                    y: parseFloat(imageWrapper.style.top) || 20
                } : null,
                imageSize: customImage.style.display !== 'none' ? {
                    width: customImage.offsetWidth,
                    height: customImage.offsetHeight
                } : null
            };

            // Save the design first
            const saveResponse = await fetch('/api/save-merch-design', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    designData: designImage,
                    designDetails: designDetails
                })
            });

            if (!saveResponse.ok) {
                throw new Error('Failed to save design');
            }

            const { designId } = await saveResponse.json();

            // Send to cart with design ID and all details
            const cartData = {
                options: {
                    size: tshirtSize.value,
                    designId: designId,
                    design: designImage,
                    text: designDetails.text,
                    textColor: designDetails.textColor,
                    fontSize: designDetails.fontSize,
                    fontFamily: designDetails.fontFamily,
                    position: designDetails.position,
                    imagePosition: designDetails.imagePosition,
                    imageSize: designDetails.imageSize
                }
            };

            console.log('Sending cart data:', {
                ...cartData,
                options: {
                    ...cartData.options,
                    design: cartData.options.design.substring(0, 100) + '...'
                }
            });

            // Send to server
            const response = await fetch('/api/cart/add-merch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(cartData)
            });

            if (!response.ok) {
                throw new Error(await response.text() || 'Failed to add item to cart');
            }

            // Redirect to cart
            window.location.href = '/profile#cart';
        } catch (error) {
            console.error('Error adding to cart:', error);
            alert('Failed to add item to cart: ' + error.message);
        } finally {
            // Re-enable the button
            addToCartBtn.disabled = false;
            addToCartBtn.textContent = 'Add to Cart';
        }
    }

    // Add to cart button handler
    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', addToCart);
    }
});
