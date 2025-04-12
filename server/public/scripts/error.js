function displayErrorFancy(errorObj) {
  const container = document.getElementById("error-display");
  container.innerHTML = "";

  const pre = document.createElement("pre");
  pre.classList.add("fancy-json");
  pre.textContent = JSON.stringify(errorObj, null, 2);

  container.appendChild(pre);
  container.style.display = "block";
}
