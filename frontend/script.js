const API_BASE_URL = "https://inventarwebapp-linux-ejb2a7cpcdchhppg9.germanywestcentral-01.azurewebsites.net";

async function ladeDashboard() {
  const response = await fetch(`${API_BASE_URL}/api/dashboard`);
  const daten = await response.json();

  document.getElementById("gesamt").textContent = daten.gesamt;
  document.getElementById("verfuegbar").textContent = daten.verfügbar;
  document.getElementById("ausgeliehen").textContent = daten.ausgeliehen;
  document.getElementById("defekt").textContent = daten.defekt;
}

async function ladeInventar() {
  const status = document.getElementById("statusFilter").value;
  const standort = document.getElementById("standortFilter").value;

  let url = `${API_BASE_URL}/api/inventar`;
  const params = new URLSearchParams();

  if (status) params.append("status", status);
  if (standort) params.append("standort", standort);

  if (params.toString()) {
    url += `?${params.toString()}`;
  }

  const response = await fetch(url);
  const daten = await response.json();

  const tabelle = document.getElementById("inventarTabelle");
  tabelle.innerHTML = "";

  daten.forEach(item => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${item.id}</td>
      <td>${item.name}</td>
      <td>${item.kategorie}</td>
      <td>${item.hersteller || "-"}</td>
      <td>${item.standort}</td>
      <td class="status-${item.status}">${item.status}</td>
      <td>
        <button class="delete-btn" onclick="loescheItem(${item.id})">Löschen</button>
      </td>
    `;

    tabelle.appendChild(row);
  });
}

document.getElementById("inventarForm").addEventListener("submit", async function(event) {
  event.preventDefault();

  const item = {
    id: Number(document.getElementById("id").value),
    name: document.getElementById("name").value,
    kategorie: document.getElementById("kategorie").value,
    hersteller: document.getElementById("hersteller").value || null,
    seriennummer: document.getElementById("seriennummer").value || null,
    standort: document.getElementById("standort").value,
    status: document.getElementById("status").value,
    bemerkung: document.getElementById("bemerkung").value || null
  };

  const response = await fetch(`${API_BASE_URL}/api/inventar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(item)
  });

  if (!response.ok) {
    alert("Fehler beim Hinzufügen. Prüfe ID oder Eingaben.");
    return;
  }

  this.reset();
  await ladeInventar();
  await ladeDashboard();
});

async function loescheItem(id) {
  const bestaetigung = confirm("Gerät wirklich löschen?");

  if (!bestaetigung) return;

  await fetch(`${API_BASE_URL}/api/inventar/${id}`, {
    method: "DELETE"
  });

  await ladeInventar();
  await ladeDashboard();
}

function resetFilter() {
  document.getElementById("statusFilter").value = "";
  document.getElementById("standortFilter").value = "";
  ladeInventar();
}

ladeInventar();
ladeDashboard();