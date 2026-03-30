const config = {
  apiBaseUrl: "",
  apiTokenId: "",
  apiTokenSecret: "",
  defaultBookId: 1,
};

const form = document.getElementById("upload-form");
const titleInput = document.getElementById("title");
const descriptionInput = document.getElementById("description");
const countryInput = document.getElementById("country");
const categoryInput = document.getElementById("category");
const typeInput = document.getElementById("type");
const productDetailInput = document.getElementById("product_detail");
const crossCuttingInput = document.getElementById("cross_cutting");
const institutionInput = document.getElementById("institution");
const keywordsInput = document.getElementById("keywords");
const fileInput = document.getElementById("file");
const filePreview = document.getElementById("file-preview");
const tagsPreview = document.getElementById("tags-preview");
const statusEl = document.getElementById("status");
const openUploadBtn = document.getElementById("btn-open-upload");

function getOptions() {
  return (
    window.SLOW_UPLOAD_OPTIONS || {
      countries: [],
      categories: [],
      types: [],
      productDetails: [],
    }
  );
}

function fillSelect(selectEl, values, placeholderText) {
  selectEl.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = placeholderText;
  selectEl.appendChild(ph);
  values.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    selectEl.appendChild(opt);
  });
}

function initDropdowns() {
  const o = getOptions();
  fillSelect(countryInput, o.countries, "Select country");
  fillSelect(categoryInput, o.categories, "Select category");
  fillSelect(typeInput, o.types, "Select type");
  productDetailInput.innerHTML = "";
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "—";
  productDetailInput.appendChild(empty);
  o.productDetails.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    productDetailInput.appendChild(opt);
  });
  if (o.categories.length) {
    categoryInput.value = o.categories[0];
  }
  if (o.countries.length) {
    countryInput.value = o.countries[0];
  }
  typeInput.value = "document";
}

function buildSearchQuery(payload) {
  const parts = [];
  if (payload.country) parts.push(`country:"${payload.country}"`);
  if (payload.category) parts.push(`category:${payload.category}`);
  if (payload.type) parts.push(`type:${payload.type}`);
  if (payload.productDetail) parts.push(`product_detail:${payload.productDetail}`);
  if (payload.crossCutting) parts.push(`cross_cutting:${payload.crossCutting}`);
  if (payload.institution) parts.push(`institution:${payload.institution}`);
  if (payload.keywords) parts.push(payload.keywords);
  return parts.join(" ").trim() || "(add metadata to build query)";
}

function updateTagsPreview() {
  const o = getOptions();
  const country = countryInput.value.trim();
  const category = categoryInput.value.trim();
  const type = typeInput.value.trim();
  const productDetail = productDetailInput.value.trim();
  const crossCutting = crossCuttingInput.value.trim();
  const institution = institutionInput.value.trim();
  const keywords = keywordsInput.value.trim();
  const file = fileInput.files && fileInput.files[0] ? fileInput.files[0].name : "(none)";

  const payload = {
    country,
    category,
    type,
    productDetail,
    crossCutting,
    institution,
    keywords,
  };

  const lines = [
    `country: ${country || "—"}`,
    `category: ${category || "—"}`,
    `type: ${type || "—"}`,
    `product_detail: ${productDetail || "—"}`,
    `cross_cutting: ${crossCutting || "—"}`,
    `institution: ${institution || "—"}`,
    `keywords: ${keywords || "—"}`,
    `file: ${file}`,
    "",
    "Search-style query:",
    buildSearchQuery(payload),
  ];

  if (o.countries.length === 0) {
    lines.unshift("(Load metadata.js so dropdowns match Android.)");
  }

  tagsPreview.textContent = lines.join("\n");
}

function setStatus(message, ok) {
  statusEl.textContent = message;
  statusEl.className = ok ? "status ok" : "status err";
}

function appendUploadHistory(payload) {
  const key = "slow_upload_history";
  const existing = JSON.parse(localStorage.getItem(key) || "[]");
  existing.unshift(payload);
  localStorage.setItem(key, JSON.stringify(existing.slice(0, 50)));
}

function saveMockLocally(payload) {
  localStorage.setItem("slow_latest_submission", JSON.stringify(payload));
  appendUploadHistory(payload);
}

function selectedFilename() {
  const file = fileInput.files && fileInput.files[0];
  return file ? file.name : null;
}

function validatePayload(payload) {
  const o = getOptions();
  if (!payload.title) return "Enter a title.";
  if (payload.description.length < 10) return "Short description must be at least 10 characters.";
  if (!payload.country || !o.countries.includes(payload.country)) return "Choose a valid country.";
  if (!payload.category || !o.categories.includes(payload.category)) return "Choose a valid category.";
  if (!payload.type || !o.types.includes(payload.type)) return "Choose a valid type.";
  if (!payload.filename) return "Choose a file to upload.";
  if (payload.productDetail && !o.productDetails.includes(payload.productDetail)) {
    return "Product detail must be one of the listed options or left blank.";
  }
  return null;
}

function buildOptionalTags(payload) {
  const tags = [];
  if (payload.productDetail) tags.push({ name: "product_detail", value: payload.productDetail });
  if (payload.crossCutting) tags.push({ name: "cross_cutting", value: payload.crossCutting });
  if (payload.institution) tags.push({ name: "institution", value: payload.institution });
  if (payload.keywords) tags.push({ name: "keywords", value: payload.keywords });
  return tags;
}

async function tryBookStackSubmit(payload) {
  if (!config.apiBaseUrl || !config.apiTokenId || !config.apiTokenSecret) {
    return { success: false, message: "No API credentials configured." };
  }

  const baseTags = [
    { name: "country", value: payload.country },
    { name: "category", value: payload.category },
    { name: "type", value: payload.type },
    ...buildOptionalTags(payload),
  ];

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
        <p>${escapeHtml(payload.description)}</p>
        <p><strong>Country:</strong> ${escapeHtml(payload.country)}</p>
        <p><strong>Category:</strong> ${escapeHtml(payload.category)}</p>
        <p><strong>Type:</strong> ${escapeHtml(payload.type)}</p>
        ${optionalHtml(payload)}
        <p><strong>Selected file:</strong> ${escapeHtml(payload.filename || "none")} (attachment upload pending)</p>
      `,
      tags: baseTags,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    return { success: false, message: `BookStack API failed (${response.status}): ${text.slice(0, 220)}` };
  }

  return { success: true, message: "Uploaded to BookStack successfully." };
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function optionalHtml(payload) {
  let html = "";
  if (payload.productDetail) {
    html += `<p><strong>Product detail:</strong> ${escapeHtml(payload.productDetail)}</p>`;
  }
  if (payload.crossCutting) {
    html += `<p><strong>Cross-cutting:</strong> ${escapeHtml(payload.crossCutting)}</p>`;
  }
  if (payload.institution) {
    html += `<p><strong>Institution:</strong> ${escapeHtml(payload.institution)}</p>`;
  }
  if (payload.keywords) {
    html += `<p><strong>Keywords:</strong> ${escapeHtml(payload.keywords)}</p>`;
  }
  return html;
}

[
  countryInput,
  categoryInput,
  typeInput,
  productDetailInput,
  crossCuttingInput,
  institutionInput,
  keywordsInput,
  titleInput,
  descriptionInput,
].forEach((el) => el.addEventListener("input", updateTagsPreview));
fileInput.addEventListener("change", () => {
  const name = selectedFilename();
  filePreview.textContent = `Selected file: ${name || "none"}`;
  updateTagsPreview();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    title: titleInput.value.trim(),
    description: descriptionInput.value.trim(),
    country: countryInput.value.trim(),
    category: categoryInput.value.trim(),
    type: typeInput.value.trim(),
    productDetail: productDetailInput.value.trim(),
    crossCutting: crossCuttingInput.value.trim(),
    institution: institutionInput.value.trim(),
    keywords: keywordsInput.value.trim(),
    filename: selectedFilename(),
    submittedAt: new Date().toISOString(),
  };

  const validationError = validatePayload(payload);
  if (validationError) {
    setStatus(validationError, false);
    return;
  }

  saveMockLocally(payload);
  setStatus("Saved locally. Attempting BookStack upload if configured...", true);

  try {
    const result = await tryBookStackSubmit(payload);
    if (result.success) {
      setStatus(result.message, true);
      form.reset();
      initDropdowns();
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
  titleInput.focus();
});

initDropdowns();
updateTagsPreview();
