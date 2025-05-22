document.addEventListener('DOMContentLoaded', function () {
    let tshirtModel = document.getElementById('tshirt-model');
    const textOverlay = document.getElementById('text-overlay');
    const textInput = document.getElementById('text-input');
    const textColorPicker = document.getElementById('text-color-picker');
    const fontSize = document.getElementById('font-size');
    const imageUpload = document.getElementById('image-upload');
    const customImage = document.getElementById('custom-image');
    const imageWrapper = document.getElementById('image-wrapper');
    const resizeHandle = imageWrapper.querySelector('.resize-handle');
    const tshirtSize = document.getElementById('tshirt-size');

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

    // Upload custom image
    imageUpload.addEventListener('change', function (e) {
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
});
