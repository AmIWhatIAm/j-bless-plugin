const form = document.getElementById("settings-form");
const keyInput = document.getElementById("routes-api-key");
const statusEl = document.getElementById("status");

chrome.storage.local.get(["routesApiKey"], ({ routesApiKey }) => {
  if (routesApiKey) {
    keyInput.value = routesApiKey;
    statusEl.textContent = "A Routes API key is already saved.";
  }
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  chrome.storage.local.set({ routesApiKey: keyInput.value.trim() }, () => {
    statusEl.textContent = "Routes API key saved.";
  });
});
