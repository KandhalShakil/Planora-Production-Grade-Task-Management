const API_TASKS = '/api/tasks';
const token = localStorage.getItem('token');

if (!token) window.location.href = 'login.html';

// ─── DOM Elements ───────────────────────────────────────────────
const taskList = document.getElementById('taskList'),
      taskCount = document.getElementById('taskCount'),
      emptyState = document.getElementById('emptyState'),
      loader = document.getElementById('loader'),
      searchInput = document.getElementById('searchInput'),
      sortSelect = document.getElementById('sortSelect'),
      priorityFilter = document.getElementById('priorityFilter'),
      sidebarToggle = document.getElementById('sidebarToggle'),
      sidebar = document.querySelector('.sidebar'),
      sidebarOverlay = document.getElementById('sidebarOverlay'),
      navItems = document.querySelectorAll('.nav-item'),
      logoutBtn = document.getElementById('logoutBtn'),
      taskModal = document.getElementById('taskModal'),
      taskForm = document.getElementById('taskForm'),
      openAddModalBtn = document.getElementById('openAddModal'),
      closeModalBtns = document.querySelectorAll('.close-modal');

// ─── App State ──────────────────────────────────────────────────
let allTasks = [],
    isFetching = false,
    activeStatus = '',
    activePriority = '',
    activeSearch = '',
    activeSort = '-createdAt';

// ─── INITIALIZE: fetch once on page load ────────────────────────
document.addEventListener('DOMContentLoaded', () => fetchAllTasks());

// ─────────────────────────────────────────────────────────────────
// NETWORK LAYER — called ONLY on: initial load + after CRUD mutations
// ─────────────────────────────────────────────────────────────────
async function fetchAllTasks() {
    if (isFetching) return;
    isFetching = true;
    showLoader();

    try {
        // Fetch ALL tasks (no pagination params) so we can filter locally
        const res = await fetch(`${API_TASKS}?limit=1000`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.status === 401) { localStorage.removeItem('token'); window.location.href = 'login.html'; return; }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        allTasks = data.data;
        applyFiltersAndRender();

    } catch (err) {
        console.error('[Planora] fetchAllTasks error:', err.message);
        allTasks.length > 0 ? (applyFiltersAndRender(), showPopup('Could not refresh. Showing cached data.', 'warning')) : showFetchError();
    } finally {
        hideLoader();
        isFetching = false;
    }
}

// ─────────────────────────────────────────────────────────────────
// LOCAL FILTER ENGINE — zero API calls, instant response
// ─────────────────────────────────────────────────────────────────
function applyFiltersAndRender() {
    let tasks = [...allTasks];
    if (activeStatus === 'pending') tasks = tasks.filter(t => !t.completed);
    else if (activeStatus === 'completed') tasks = tasks.filter(t => t.completed);
    if (activePriority) tasks = tasks.filter(t => t.priority === activePriority);
    if (activeSearch) {
        const q = activeSearch.toLowerCase();
        tasks = tasks.filter(t => t.title.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q)));
    }
    tasks = sortTasks(tasks, activeSort);
    taskCount.textContent = tasks.length;
    renderTasks(tasks);
}

function sortTasks(tasks, sort) {
    return [...tasks].sort((a, b) => {
        switch (sort) {
            case '-createdAt': return new Date(b.createdAt) - new Date(a.createdAt);
            case 'createdAt':  return new Date(a.createdAt) - new Date(b.createdAt);
            case 'dueDate':    return (a.dueDate ? new Date(a.dueDate) : Infinity) - (b.dueDate ? new Date(b.dueDate) : Infinity);
            case 'priority': {
                const order = { high: 0, medium: 1, low: 2 };
                return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
            }
            case 'title': return a.title.localeCompare(b.title);
            default: return 0;
        }
    });
}

// ─── EVENT LISTENERS ────────────────────────────────────────────
sidebarToggle.addEventListener('click', () => { sidebar.classList.toggle('open'); sidebarOverlay.classList.toggle('active'); });
sidebarOverlay.addEventListener('click', () => { sidebar.classList.remove('open'); sidebarOverlay.classList.remove('active'); });
navItems.forEach(item => item.addEventListener('click', () => {
    navItems.forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    activeStatus = item.dataset.status || '';
    applyFiltersAndRender();
    if (window.innerWidth <= 1024) { sidebar.classList.remove('open'); sidebarOverlay.classList.remove('active'); }
}));
searchInput.addEventListener('input', debounce(() => { activeSearch = searchInput.value.trim(); applyFiltersAndRender(); }, 200));
sortSelect.addEventListener('change', () => { activeSort = sortSelect.value; applyFiltersAndRender(); });
priorityFilter.addEventListener('change', () => { activePriority = priorityFilter.value; applyFiltersAndRender(); });
logoutBtn.addEventListener('click', () => { localStorage.removeItem('token'); localStorage.removeItem('user'); window.location.href = 'login.html'; });

// ─── UI HELPERS ─────────────────────────────────────────────────
function showLoader() { loader.classList.remove('hidden'); emptyState.classList.add('hidden'); }
function hideLoader() { loader.classList.add('hidden'); }
function showFetchError() {
    taskList.innerHTML = '';
    taskList.classList.add('hidden');
    emptyState.innerHTML = `<div class="empty-state-content"><i class="fas fa-wifi empty-state-icon" style="-webkit-text-fill-color: unset; color: var(--danger); opacity: 0.6;"></i><h3 class="empty-state-title">Could not load tasks</h3><p class="empty-state-description">There was a problem connecting to the server. Please check your connection and try again.</p><button class="btn btn-primary" onclick="fetchAllTasks()"><i class="fas fa-redo"></i> Retry</button></div>`;
    emptyState.classList.remove('hidden');
}

// ─── RENDER ─────────────────────────────────────────────────────
function renderTasks(tasks) {
    if (!tasks.length) {
        taskList.innerHTML = '';
        taskList.classList.add('hidden');
        const isFiltered = activeStatus || activePriority || activeSearch;
        emptyState.innerHTML = `<div class="empty-state-content"><i class="fas fa-${isFiltered ? 'filter' : 'tasks'} empty-state-icon"></i><h3 class="empty-state-title">${isFiltered ? 'No matching tasks' : 'No tasks yet'}</h3><p class="empty-state-description">${isFiltered ? 'Try adjusting your filters or search query.' : 'Your task list is empty. Create your first task to get started!'}</p>${isFiltered ? '<button class="btn btn-secondary" onclick="clearAllFilters()"><i class="fas fa-times"></i> Clear Filters</button>' : '<button class="btn btn-primary" onclick="document.getElementById(\'openAddModal\').click()"><i class="fas fa-plus"></i> Create First Task</button>'}</div>`;
        emptyState.classList.remove('hidden');
        return;
    }
    emptyState.classList.add('hidden');
    taskList.classList.remove('hidden');
    taskList.innerHTML = tasks.map(task => buildTaskCard(task)).join('');
}

function buildTaskCard(task) {
    // Check if overdue: only if due date is BEFORE today (not including today)
    const isOverdue = !task.completed && task.dueDate && (() => {
        const dueDate = new Date(task.dueDate);
        const today = new Date();
        dueDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        return dueDate < today;
    })();
    const dueLabel = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date';
    return `
        <div class="task-card ${task.completed ? 'task-done' : ''}" data-id="${task._id}">
            <div class="card-top">
                <span class="priority-badge priority-${task.priority}">${task.priority}</span>
                <div class="card-actions">
                    <button class="icon-btn btn-check" onclick="toggleComplete('${task._id}', ${task.completed})" title="${task.completed ? 'Mark Incomplete' : 'Mark Complete'}">
                        <i class="fas ${task.completed ? 'fa-check-circle' : 'fa-circle'}"></i>
                    </button>
                    <button class="icon-btn" onclick="editTask('${task._id}')" title="Edit Task">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="icon-btn btn-del" onclick="deleteTask('${task._id}')" title="Delete Task">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <h3 class="task-title">${escapeHtml(task.title)}</h3>
            <p class="task-desc">${escapeHtml(task.description || 'No description provided.')}</p>
            <div class="card-footer">
                <span class="due-date ${isOverdue ? 'due-date-overdue' : ''}"><i class="fas fa-calendar"></i> ${dueLabel}</span>
                ${isOverdue ? '<span class="alert-pill alert-overdue"><i class="fas fa-triangle-exclamation"></i> Overdue</span>' : ''}
                <span class="status-pill ${task.completed ? 'status-done' : 'status-pending'}">
                    ${task.completed ? 'Done' : 'Pending'}
                </span>
            </div>
        </div>
    `;
}

function clearAllFilters() { activeStatus = ''; activePriority = ''; activeSearch = ''; searchInput.value = ''; priorityFilter.value = ''; navItems.forEach(i => i.classList.remove('active')); navItems[0]?.classList.add('active'); applyFiltersAndRender(); }


const setMinDate = () => { const el = document.getElementById('dueDate'); if (el) el.setAttribute('min', new Date().toISOString().split('T')[0]); };
openAddModalBtn.addEventListener('click', () => { document.getElementById('modalTitle').textContent = 'Add New Task'; document.getElementById('taskId').value = ''; taskForm.reset(); setMinDate(); taskModal.classList.add('show'); });
closeModalBtns.forEach(btn => btn.addEventListener('click', () => taskModal.classList.remove('show')));


taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const taskId   = document.getElementById('taskId').value;
    const formData = {
        title:       document.getElementById('title').value.trim(),
        description: document.getElementById('description').value.trim(),
        dueDate:     document.getElementById('dueDate').value,
        priority:    document.getElementById('priority').value
    };

    if (!formData.title) { showPopup('Title is required.', 'error'); return; }

    taskModal.classList.remove('show');  // close immediately

    if (taskId) {
        // ─── UPDATE (optimistic) ─────────────────────────────────
        const idx      = allTasks.findIndex(t => t._id === taskId);
        const original = { ...allTasks[idx] };
        if (idx !== -1) allTasks[idx] = { ...original, ...formData };
        applyFiltersAndRender();
        showPopup('✏️ Task updated!', 'success');

        try {
            const res  = await fetch(`${API_TASKS}/${taskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body:   JSON.stringify(formData)
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            if (idx !== -1) allTasks[idx] = data.data;  // swap in server copy
        } catch {
            if (idx !== -1) allTasks[idx] = original;   // revert
            applyFiltersAndRender();
            showPopup('Update failed. Changes reverted.', 'error');
        }

    } else {
        // ─── CREATE (optimistic) ─────────────────────────────────
        const tempId   = '__temp__' + Date.now();
        const tempTask = { _id: tempId, ...formData, completed: false, createdAt: new Date().toISOString() };

        allTasks.unshift(tempTask);
        applyFiltersAndRender();
        showPopup('✅ Task created!', 'success');

        // Animate first card
        const newCard = taskList.querySelector(`[data-id="${tempId}"]`);
        if (newCard) newCard.style.animation = 'cardSlideIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both';

        try {
            const res  = await fetch(API_TASKS, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body:   JSON.stringify(formData)
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            // Swap temp entry with server's real task
            const tempIdx = allTasks.findIndex(t => t._id === tempId);
            if (tempIdx !== -1) allTasks[tempIdx] = data.data;
            applyFiltersAndRender();
        } catch {
            allTasks = allTasks.filter(t => t._id !== tempId);
            applyFiltersAndRender();
            showPopup('Could not create task. Please try again.', 'error');
        }
    }
});

// ── DELETE (optimistic) ──
async function deleteTask(id) {
    showConfirm('This task will be permanently removed.', async () => {
        const card       = taskList.querySelector(`[data-id="${id}"]`);
        const deletedIdx = allTasks.findIndex(t => t._id === id);
        const snapshot   = allTasks[deletedIdx];

        // Animate out then remove from state
        if (card) {
            card.style.animation = 'cardSlideOut 0.3s ease forwards';
            await new Promise(r => setTimeout(r, 280));
        }

        allTasks = allTasks.filter(t => t._id !== id);
        applyFiltersAndRender();
        showPopup('🗑️ Task removed.', 'success');

        try {
            const res = await fetch(`${API_TASKS}/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
        } catch {
            if (snapshot) allTasks.splice(deletedIdx, 0, snapshot);  // revert
            applyFiltersAndRender();
            showPopup('Delete failed. Task restored.', 'error');
        }
    });
}

// ── TOGGLE COMPLETE (optimistic, surgical DOM update) ──
async function toggleComplete(id, isDone) {
    const newState = !isDone;

    // Update allTasks in memory
    const task = allTasks.find(t => t._id === id);
    if (task) task.completed = newState;

    // Surgically update the card DOM — no re-render needed
    const card = taskList.querySelector(`[data-id="${id}"]`);
    if (card) applyCardState(card, id, newState);

    // Save silently
    try {
        const res = await fetch(`${API_TASKS}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body:   JSON.stringify({ completed: newState })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
    } catch {
        // Revert
        if (task) task.completed = isDone;
        if (card) applyCardState(card, id, isDone);
        showPopup('Could not update task. Please try again.', 'error');
    }
}

function applyCardState(card, id, completed) {
    const btn        = card.querySelector('.btn-check');
    const icon       = btn?.querySelector('i');
    const titleEl    = card.querySelector('.task-title');
    const statusPill = card.querySelector('.status-pill');

    if (completed) {
        card.classList.add('task-done');
        if (icon)       icon.className = 'fas fa-check-circle';
        if (btn)        btn.title      = 'Mark Incomplete';
        if (titleEl)    titleEl.style.textDecoration = 'line-through';
        if (statusPill) { statusPill.textContent = 'Done'; statusPill.className = 'status-pill status-done'; }
    } else {
        card.classList.remove('task-done');
        if (icon)       icon.className = 'fas fa-circle';
        if (btn)        btn.title      = 'Mark Complete';
        if (titleEl)    titleEl.style.textDecoration = '';
        if (statusPill) { statusPill.textContent = 'Pending'; statusPill.className = 'status-pill status-pending'; }
    }
    if (btn) btn.setAttribute('onclick', `toggleComplete('${id}', ${completed})`);
}

// ── EDIT (reads from local cache — zero API call) ──
async function editTask(id) {
    const task = allTasks.find(t => t._id === id);
    if (!task) { showPopup('Task not found.', 'error'); return; }

    setMinDate();
    document.getElementById('modalTitle').textContent = 'Edit Task';
    document.getElementById('taskId').value           = task._id;
    document.getElementById('title').value            = task.title;
    document.getElementById('description').value      = task.description || '';
    document.getElementById('dueDate').value          = task.dueDate ? task.dueDate.split('T')[0] : '';
    document.getElementById('priority').value         = task.priority;
    taskModal.classList.add('show');
}

// ─── Utility ─────────────────────────────────────────────────────
function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(str)));
    return div.innerHTML;
}
