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

    // Change text content
    textInput.addEventListener('input', function () {
        textOverlay.textContent = this.value;
    });

    // Change text color
    textColorPicker.addEventListener('input', function () {
        textOverlay.style.color = this.value;
    });

    // Change font size
    fontSize.addEventListener('input', function () {
        textOverlay.style.fontSize = `${this.value}px`;
    });

    // Upload custom image
    imageUpload.addEventListener('change', function (event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                customImage.src = e.target.result;
                customImage.style.display = 'block';
                imageWrapper.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });

    // Make text draggable
    let isDraggingText = false;
    let offsetX, offsetY;

    textOverlay.addEventListener('mousedown', function (e) {
        isDraggingText = true;
        offsetX = e.offsetX;
        offsetY = e.offsetY;
    });

    document.addEventListener('mousemove', function (e) {
        if (isDraggingText) {
            const x = e.clientX - offsetX - tshirtModel.getBoundingClientRect().left;
            const y = e.clientY - offsetY - tshirtModel.getBoundingClientRect().top;
            textOverlay.style.left = `${x}px`;
            textOverlay.style.top = `${y}px`;
        }
    });

    document.addEventListener('mouseup', function () {
        isDraggingText = false;
    });

    // Make image draggable
    let isDraggingImage = false;

    imageWrapper.addEventListener('mousedown', function (e) {
        if (e.target === resizeHandle) return; // Skip if resizing
        isDraggingImage = true;
        offsetX = e.offsetX;
        offsetY = e.offsetY;
    });

    document.addEventListener('mousemove', function (e) {
        if (isDraggingImage) {
            const x = e.clientX - offsetX - tshirtModel.getBoundingClientRect().left;
            const y = e.clientY - offsetY - tshirtModel.getBoundingClientRect().top;
            imageWrapper.style.left = `${x}px`;
            imageWrapper.style.top = `${y}px`;
        }
    });

    document.addEventListener('mouseup', function () {
        isDraggingImage = false;
    });

    // Make image resizable
    let isResizing = false;

    resizeHandle.addEventListener('mousedown', function (e) {
        isResizing = true;
        e.preventDefault(); // Prevent text selection
    });

    document.addEventListener('mousemove', function (e) {
        if (isResizing) {
            const newWidth = e.clientX - imageWrapper.getBoundingClientRect().left;
            const newHeight = e.clientY - imageWrapper.getBoundingClientRect().top;
            customImage.style.width = `${newWidth}px`;
            customImage.style.height = `${newHeight}px`;
        }
    });

    document.addEventListener('mouseup', function () {
        isResizing = false;
    });

    tshirtModel = document.getElementById('tshirt-model');
    const tshirtSize = document.getElementById('tshirt-size');

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
