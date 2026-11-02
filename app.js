(function () {
  "use strict";

  const STORAGE_KEY = "sproutPlants";
  const PRIORITY_ORDER = { high: 0, normal: 1, low: 2 };
  const PRIORITY_LABELS = { high: "High", normal: "Normal", low: "Low" };

  const storage = {
    get: function (key, fallback) {
      try {
        const saved = localStorage.getItem(key);
        return saved === null ? fallback : JSON.parse(saved);
      } catch (error) {
        return fallback;
      }
    },
    set: function (key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        showToast("Your changes could not be saved in this browser.");
      }
    }
  };

  function localDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function dateOffset(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return localDateString(date);
  }

  function makeInitialPlants() {
    return INITIAL_PLANTS.map(function (plant, index) {
      return {
        id: "sample-" + index,
        name: plant.name,
        species: plant.species,
        interval: plant.interval,
        priority: plant.priority,
        lastWatered: dateOffset(plant.daysSinceWatered)
      };
    });
  }

  let plants = storage.get(STORAGE_KEY, null);
  if (!Array.isArray(plants)) {
    plants = makeInitialPlants();
    storage.set(STORAGE_KEY, plants);
  }

  let activeFilter = "all";
  let toastTimer;
  const list = document.getElementById("plant-list");
  const form = document.getElementById("plant-form");
  const emptyState = document.getElementById("empty-state");
  const plantCount = document.getElementById("plant-count");
  const dueCount = document.getElementById("due-count");
  const overviewNote = document.getElementById("overview-note");
  const toast = document.getElementById("toast");

  function daysUntilDue(plant) {
    const watered = plant.lastWatered.split("-").map(Number);
    const lastWateredDate = Date.UTC(watered[0], watered[1] - 1, watered[2]);
    const todayParts = localDateString(new Date()).split("-").map(Number);
    const today = Date.UTC(todayParts[0], todayParts[1] - 1, todayParts[2]);
    const elapsed = Math.floor((today - lastWateredDate) / 86400000);
    return Number(plant.interval) - elapsed;
  }

  function savePlants() {
    storage.set(STORAGE_KEY, plants);
  }

  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.hidden = true;
    }, 3200);
  }

  function makePrioritySelect(plant) {
    const label = document.createElement("label");
    label.className = "priority-control";
    label.appendChild(document.createTextNode("Priority "));

    const select = document.createElement("select");
    select.setAttribute("aria-label", "Priority for " + plant.name);
    ["high", "normal", "low"].forEach(function (priority) {
      const option = document.createElement("option");
      option.value = priority;
      option.textContent = PRIORITY_LABELS[priority];
      option.selected = plant.priority === priority;
      select.appendChild(option);
    });
    select.addEventListener("change", function () {
      plant.priority = select.value;
      savePlants();
      renderPlants();
    });
    label.appendChild(select);
    return label;
  }

  function makePlantCard(plant) {
    const daysLeft = daysUntilDue(plant);
    const isDue = daysLeft <= 0;
    const card = document.createElement("article");
    card.className = "plant-card" + (isDue ? " is-due" : "");

    const avatar = document.createElement("div");
    avatar.className = "plant-avatar avatar-" + (Math.abs(plant.name.length) % 4);
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = plant.name.slice(0, 1).toUpperCase();

    const details = document.createElement("div");
    details.className = "plant-details";
    const name = document.createElement("h3");
    name.textContent = plant.name;
    const species = document.createElement("p");
    species.textContent = plant.species || "Your leafy friend";
    details.append(name, species);

    const due = document.createElement("div");
    due.className = "due-status" + (isDue ? " due-now" : "");
    const status = document.createElement("span");
    status.className = "due-label";
    status.textContent = daysLeft < 0 ? "Overdue" : (daysLeft === 0 ? "Due today" : "Up next");
    const date = document.createElement("span");
    date.className = "due-date";
    date.textContent = daysLeft < 0
      ? Math.abs(daysLeft) + (Math.abs(daysLeft) === 1 ? " day late" : " days late")
      : (daysLeft === 0 ? "Give me a drink" : "In " + daysLeft + (daysLeft === 1 ? " day" : " days"));
    due.append(status, date);

    const controls = document.createElement("div");
    controls.className = "plant-controls";
    controls.appendChild(makePrioritySelect(plant));

    const wateredButton = document.createElement("button");
    wateredButton.type = "button";
    wateredButton.className = isDue ? "water-button" : "water-button secondary-water";
    wateredButton.textContent = isDue ? "Watered" : "Water now";
    wateredButton.addEventListener("click", function () {
      plant.lastWatered = localDateString(new Date());
      savePlants();
      renderPlants();
      showToast(plant.name + " is marked as watered.");
    });

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-button";
    removeButton.textContent = "×";
    removeButton.title = "Remove " + plant.name;
    removeButton.setAttribute("aria-label", "Remove " + plant.name + " from your garden");
    removeButton.addEventListener("click", function () {
      plants = plants.filter(function (item) { return item.id !== plant.id; });
      savePlants();
      renderPlants();
      showToast(plant.name + " was removed from your garden.");
    });

    controls.append(wateredButton, removeButton);
    card.append(avatar, details, due, controls);
    return card;
  }

  function renderPlants() {
    const duePlants = plants.filter(function (plant) { return daysUntilDue(plant) <= 0; });
    const visiblePlants = plants
      .filter(function (plant) { return activeFilter === "all" || daysUntilDue(plant) <= 0; })
      .sort(function (first, second) {
        const firstIsDue = daysUntilDue(first) <= 0;
        const secondIsDue = daysUntilDue(second) <= 0;
        if (firstIsDue !== secondIsDue) return firstIsDue ? -1 : 1;
        const priority = PRIORITY_ORDER[first.priority] - PRIORITY_ORDER[second.priority];
        if (priority !== 0) return priority;
        return daysUntilDue(first) - daysUntilDue(second);
      });

    plantCount.textContent = String(plants.length).padStart(2, "0");
    dueCount.textContent = String(duePlants.length).padStart(2, "0");
    overviewNote.textContent = duePlants.length === 0
      ? "All caught up. Enjoy your thriving garden."
      : duePlants.length === 1
        ? "One plant could use a little love today."
        : duePlants.length + " plants could use a little love today.";
    list.replaceChildren.apply(list, visiblePlants.map(makePlantCard));
    emptyState.hidden = visiblePlants.length > 0;
    emptyState.textContent = plants.length === 0
      ? "Your garden is empty. Add your first leafy friend."
      : "Nothing needs watering right now. Nice work!";
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const formData = new FormData(form);
    const name = String(formData.get("name")).trim();
    if (!name) {
      showToast("Give your plant a name first.");
      return;
    }
    plants.push({
      id: "plant-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      name: name,
      species: String(formData.get("species")).trim(),
      interval: Number(formData.get("interval")),
      priority: String(formData.get("priority")),
      lastWatered: localDateString(new Date())
    });
    savePlants();
    form.reset();
    document.getElementById("watering-interval").value = "7";
    renderPlants();
    showToast("A new leafy friend joined your garden.");
  });

  document.querySelectorAll("[data-filter]").forEach(function (button) {
    button.addEventListener("click", function () {
      activeFilter = button.getAttribute("data-filter");
      document.querySelectorAll("[data-filter]").forEach(function (filterButton) {
        const selected = filterButton === button;
        filterButton.classList.toggle("is-active", selected);
        filterButton.setAttribute("aria-pressed", String(selected));
      });
      renderPlants();
    });
  });

  document.getElementById("sitter-interest").addEventListener("click", function () {
    document.getElementById("sitter-message").hidden = false;
  });

  function showView() {
    const requested = (window.location.hash || "#garden").slice(1);
    const views = document.querySelectorAll("[data-view]");
    const exists = Array.prototype.some.call(views, function (view) { return view.id === requested; });
    const current = exists ? requested : "garden";
    views.forEach(function (view) { view.hidden = view.id !== current; });
    document.querySelectorAll("nav a").forEach(function (link) {
      if (link.getAttribute("href") === "#" + current) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", showView);
  renderPlants();
  showView();
})();