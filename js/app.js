// ---------------------------------------------------------------
// app.js — dashboard, CRUD, search, filter, and analytics for the
// service_requests table.
// ---------------------------------------------------------------

const TABLE = "service_requests";

let currentUser = null;
let allRequests = []; // last fetch from Supabase, filtered/rendered client-side
let editingId = null; // null = create mode, otherwise id being edited

const CATEGORIES = [
  "Computer Repair",
  "Software Installation",
  "Internet/Network Problem",
  "Printer Problem",
  "Account/Access Concern",
  "Other",
];

// ---------- bootstrap -----------------------------------------------

document.addEventListener("DOMContentLoaded", async () => {
  // Only run on index.html (has #requests-tbody)
  if (!document.getElementById("requests-tbody")) return;

  currentUser = await requireAuth();
  if (!currentUser) return; // requireAuth already redirected

  document.getElementById("who-email").textContent = currentUser.email;
  document.getElementById("btn-logout").addEventListener("click", logout);

  populateCategorySelect();
  wireToolbar();
  wireModal();

  await loadRequests();
});

// ---------- data loading ---------------------------------------------

async function loadRequests() {
  setTableLoading();

  // READ: RLS policy allows any authenticated user to SELECT all rows.
  const { data, error } = await supabaseClient
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    showToast("Could not load requests: " + error.message, true);
    allRequests = [];
  } else {
    allRequests = data || [];
  }

  renderDashboard(allRequests);
  renderAnalytics(allRequests);
  applyFiltersAndRender();
}

function setTableLoading() {
  const tbody = document.getElementById("requests-tbody");
  tbody.innerHTML = `<tr class="empty-row"><td colspan="8">Loading requests…</td></tr>`;
}

// ---------- dashboard ---------------------------------------------------

function renderDashboard(requests) {
  const total = requests.length;
  const pending = requests.filter((r) => r.status === "Pending").length;
  const inProgress = requests.filter((r) => r.status === "In Progress").length;
  const completed = requests.filter((r) => r.status === "Completed").length;

  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-pending").textContent = pending;
  document.getElementById("stat-progress").textContent = inProgress;
  document.getElementById("stat-completed").textContent = completed;
}

// ---------- analytics (bonus: by category / by priority) ---------------

function renderAnalytics(requests) {
  const catCounts = {};
  CATEGORIES.forEach((c) => (catCounts[c] = 0));
  requests.forEach((r) => {
    catCounts[r.category] = (catCounts[r.category] || 0) + 1;
  });

  const priCounts = { High: 0, Medium: 0, Low: 0 };
  requests.forEach((r) => {
    if (priCounts[r.priority] !== undefined) priCounts[r.priority]++;
  });

  const maxCat = Math.max(1, ...Object.values(catCounts));
  const maxPri = Math.max(1, ...Object.values(priCounts));

  const catEl = document.getElementById("analytics-category");
  catEl.innerHTML = Object.entries(catCounts)
    .filter(([, count]) => count > 0 || requests.length === 0)
    .map(
      ([label, count]) => `
      <div class="bar-row">
        <span>${escapeHtml(label)}</span>
        <div class="bar-track"><div class="bar-fill cat" style="width:${(count / maxCat) * 100}%"></div></div>
        <span>${count}</span>
      </div>`
    )
    .join("") || `<p class="hint">No data yet.</p>`;

  const priEl = document.getElementById("analytics-priority");
  priEl.innerHTML = Object.entries(priCounts)
    .map(
      ([label, count]) => `
      <div class="bar-row">
        <span>${escapeHtml(label)}</span>
        <div class="bar-track"><div class="bar-fill pri-${label.toLowerCase()}" style="width:${(count / maxPri) * 100}%"></div></div>
        <span>${count}</span>
      </div>`
    )
    .join("");
}

// ---------- search & filter (intermediate-level requirement) -----------

function wireToolbar() {
  document.getElementById("search-input").addEventListener("input", applyFiltersAndRender);
  document.getElementById("filter-status").addEventListener("change", applyFiltersAndRender);
  document.getElementById("filter-priority").addEventListener("change", applyFiltersAndRender);
  document.getElementById("btn-new-request").addEventListener("click", () => openModal());
}

function applyFiltersAndRender() {
  const term = document.getElementById("search-input").value.trim().toLowerCase();
  const statusFilter = document.getElementById("filter-status").value;
  const priorityFilter = document.getElementById("filter-priority").value;

  let rows = allRequests;

  if (term) {
    rows = rows.filter(
      (r) =>
        r.requester_name.toLowerCase().includes(term) ||
        r.description.toLowerCase().includes(term)
    );
  }
  if (statusFilter !== "All") {
    rows = rows.filter((r) => r.status === statusFilter);
  }
  if (priorityFilter !== "All") {
    rows = rows.filter((r) => r.priority === priorityFilter);
  }

  renderTable(rows);
}

// ---------- table rendering --------------------------------------------

function renderTable(rows) {
  const tbody = document.getElementById("requests-tbody");

  if (rows.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8">No requests match the current search/filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows
    .map((r) => {
      const statusClass = "status-" + r.status.toLowerCase().replace(/\s+/g, "");
      const priorityClass = "priority-" + r.priority.toLowerCase();
      const canEdit = r.user_id === currentUser.id;
      return `
      <tr>
        <td class="req-id">#${String(r.id).padStart(3, "0")}</td>
        <td>${escapeHtml(r.requester_name)}<br><span class="hint" style="color:var(--slate-500);font-size:0.78rem;">${escapeHtml(r.department)}</span></td>
        <td>${escapeHtml(r.category)}</td>
        <td><span class="badge ${priorityClass}">${escapeHtml(r.priority)}</span></td>
        <td><span class="badge ${statusClass}">${escapeHtml(r.status)}</span></td>
        <td>${r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</td>
        <td class="req-desc">${escapeHtml(truncate(r.description, 70))}</td>
        <td class="row-actions">
          ${
            canEdit
              ? `<button data-action="edit" data-id="${r.id}">Edit</button> ·
                 <button data-action="delete" data-id="${r.id}" class="danger">Delete</button>`
              : `<span class="hint" style="color:var(--slate-400);font-size:0.78rem;">view only</span>`
          }
        </td>
      </tr>`;
    })
    .join("");

  tbody.querySelectorAll("button[data-action='edit']").forEach((btn) =>
    btn.addEventListener("click", () => openModal(Number(btn.dataset.id)))
  );
  tbody.querySelectorAll("button[data-action='delete']").forEach((btn) =>
    btn.addEventListener("click", () => confirmDelete(Number(btn.dataset.id)))
  );
}

// ---------- create / update modal ---------------------------------------

function populateCategorySelect() {
  const select = document.getElementById("field-category");
  select.innerHTML =
    `<option value="">Select category…</option>` +
    CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join("");
}

function wireModal() {
  document.getElementById("btn-modal-close").addEventListener("click", closeModal);
  document.getElementById("btn-modal-cancel").addEventListener("click", closeModal);
  document.getElementById("modal-backdrop").addEventListener("click", (e) => {
    if (e.target.id === "modal-backdrop") closeModal();
  });
  document.getElementById("request-form").addEventListener("submit", handleSubmit);
}

function openModal(id = null) {
  editingId = id;
  const form = document.getElementById("request-form");
  form.reset();
  clearFormErrors();

  const title = document.getElementById("modal-title");
  const statusRow = document.getElementById("row-status");

  if (id) {
    const req = allRequests.find((r) => r.id === id);
    if (!req) return;
    title.textContent = "Edit Service Request";
    document.getElementById("field-requester").value = req.requester_name;
    document.getElementById("field-department").value = req.department;
    document.getElementById("field-category").value = req.category;
    document.getElementById("field-description").value = req.description;
    document.getElementById("field-priority").value = req.priority;
    document.getElementById("field-status").value = req.status;
    statusRow.classList.remove("hidden"); // status editable only when updating (BR-06)
  } else {
    title.textContent = "New Service Request";
    statusRow.classList.add("hidden"); // BR-06: new requests are always Pending
  }

  document.getElementById("modal-backdrop").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal-backdrop").classList.add("hidden");
  editingId = null;
}

function clearFormErrors() {
  document.querySelectorAll("#request-form .form-row").forEach((row) => row.classList.remove("invalid"));
}

/**
 * Client-side validation mirroring BR-01..BR-05.
 * Returns an array of field ids that failed.
 */
function validateForm(values) {
  const invalid = [];
  if (!values.requester_name) invalid.push("field-requester"); // BR-01
  if (!values.department) invalid.push("field-department"); // BR-02
  if (!values.category) invalid.push("field-category"); // BR-03
  if (!values.description || values.description.length < 10) invalid.push("field-description"); // BR-04
  if (!["Low", "Medium", "High"].includes(values.priority)) invalid.push("field-priority"); // BR-05
  return invalid;
}

async function handleSubmit(e) {
  e.preventDefault();
  clearFormErrors();

  const values = {
    requester_name: document.getElementById("field-requester").value.trim(),
    department: document.getElementById("field-department").value.trim(),
    category: document.getElementById("field-category").value,
    description: document.getElementById("field-description").value.trim(),
    priority: document.getElementById("field-priority").value,
  };

  const invalidFields = validateForm(values);
  if (invalidFields.length > 0) {
    invalidFields.forEach((id) => {
      document.getElementById(id).closest(".form-row").classList.add("invalid");
    });
    return;
  }

  const submitBtn = document.getElementById("btn-modal-save");
  submitBtn.disabled = true;
  submitBtn.textContent = "Saving…";

  try {
    if (editingId) {
      await updateRequest(editingId, values);
    } else {
      await createRequest(values);
    }
    closeModal();
    await loadRequests();
    showToast(editingId ? "Request updated." : "Request submitted.");
  } catch (err) {
    showToast("Save failed: " + err.message, true);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Save Request";
  }
}

// CREATE — BR-06 (auto Pending), BR-09 (created_at defaults server-side)
async function createRequest(values) {
  const { error } = await supabaseClient.from(TABLE).insert([
    {
      requester_name: values.requester_name,
      department: values.department,
      category: values.category,
      description: values.description,
      priority: values.priority,
      status: "Pending",
      user_id: currentUser.id,
    },
  ]);
  if (error) throw error;
}

// UPDATE — only requester_name, department, category, description,
// priority, and status are editable, per spec section V.
async function updateRequest(id, values) {
  const status = document.getElementById("field-status").value;
  const { error } = await supabaseClient
    .from(TABLE)
    .update({
      requester_name: values.requester_name,
      department: values.department,
      category: values.category,
      description: values.description,
      priority: values.priority,
      status: status,
    })
    .eq("id", id);
  if (error) throw error;
}

// DELETE — BR-08: confirmation required before deleting.
function confirmDelete(id) {
  const req = allRequests.find((r) => r.id === id);
  if (!req) return;
  const ok = window.confirm(
    `Are you sure you want to delete this request?\n\n#${String(id).padStart(3, "0")} — ${req.requester_name} (${req.category})`
  );
  if (!ok) return;
  deleteRequest(id);
}

async function deleteRequest(id) {
  const { error } = await supabaseClient.from(TABLE).delete().eq("id", id);
  if (error) {
    showToast("Delete failed: " + error.message, true);
    return;
  }
  showToast("Request deleted.");
  await loadRequests();
}

// ---------- small helpers ------------------------------------------------

function truncate(str, n) {
  return str.length > n ? str.slice(0, n - 1) + "…" : str;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

let toastTimer = null;
function showToast(message, isError = false) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = "toast" + (isError ? " error" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 3500);
}
