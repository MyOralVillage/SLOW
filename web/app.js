const config = {
  // Optional BookStack integration:
  // Fill these values to attempt API page creation on submit.
  apiBaseUrl: "",
  apiTokenId: "",
  apiTokenSecret: "",
  defaultBookId: 1,
};

const form = document.getElementById("upload-form");
const countryInput = document.getElementById("country");
const categoryInput = document.getElementById("category");
const typeInput = document.getElementById("type");
const fileInput = document.getElementById("file");
const filePreview = document.getElementById("file-preview");
const tagsPreview = document.getElementById("tags-preview");
const statusEl = document.getElementById("status");
const openUploadBtn = document.getElementById("btn-open-upload");

function updateTagsPreview() {
  const country = countryInput.value;
  const category = categoryInput.value;
  const type = typeInput.value;
  tagsPreview.textContent = `country:${country}, category:${category}, type:${type}`;
}

function setStatus(message, ok) {
  statusEl.textContent = message;
  statusEl.className = ok ? "status ok" : "status err";
}

function saveMockLocally(payload) {
  localStorage.setItem("slow_latest_submission", JSON.stringify(payload));
}

function selectedFilename() {
  const file = fileInput.files && fileInput.files[0];
  return file ? file.name : null;
}

async function tryBookStackSubmit(payload) {
  if (!config.apiBaseUrl || !config.apiTokenId || !config.apiTokenSecret) {
    return { success: false, message: "No API credentials configured." };
  }

  const response = await fetch(`${config.apiBaseUrl.replace(/\/$/, "")}/api/pages`, {
    method: "POST",
    headers: {
      Authorization: `Token ${config.apiTokenId}:${config.apiTokenSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: payload.title,
      book_id: config.defaultBookId,
      html: `
        <p>${payload.description}</p>
        <p><strong>Country:</strong> ${payload.country}</p>
        <p><strong>Category:</strong> ${payload.category}</p>
        <p><strong>Type:</strong> ${payload.type}</p>
        <p><strong>Selected file:</strong> ${payload.filename || "none"} (attachment upload pending)</p>
      `,
      tags: [
        { name: "country", value: payload.country },
        { name: "category", value: payload.category },
        { name: "type", value: payload.type },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    return { success: false, message: `BookStack API failed (${response.status}): ${text.slice(0, 220)}` };
  }

  return { success: true, message: "Uploaded to BookStack successfully." };
}

countryInput.addEventListener("change", updateTagsPreview);
categoryInput.addEventListener("change", updateTagsPreview);
typeInput.addEventListener("change", updateTagsPreview);

fileInput.addEventListener("change", () => {
  const name = selectedFilename();
  filePreview.textContent = `Selected file: ${name || "none"}`;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    title: document.getElementById("title").value.trim(),
    description: document.getElementById("description").value.trim(),
    country: countryInput.value.trim(),
    category: categoryInput.value.trim(),
    type: typeInput.value.trim(),
    filename: selectedFilename(),
    submittedAt: new Date().toISOString(),
  };

  saveMockLocally(payload);
  setStatus("Saved locally. Attempting BookStack upload if configured...", true);

  try {
    const result = await tryBookStackSubmit(payload);
    if (result.success) {
      setStatus(result.message, true);
      form.reset();
      filePreview.textContent = "Selected file: none";
      updateTagsPreview();
      return;
    }
    setStatus(`Mock save complete. ${result.message}`, false);
  } catch (error) {
    setStatus(`Mock save complete. Upload failed: ${error.message}`, false);
  }
});

openUploadBtn.addEventListener("click", () => {
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  document.getElementById("title").focus();
});

updateTagsPreview();
