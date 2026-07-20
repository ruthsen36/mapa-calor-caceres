// Application Logic for Cáceres 99 Driver GPS Heatmap App

let map;
let heatLayer;
let markersGroup;
let currentTrips = [];
let pendingGpsLocation = null;

// Initial Configurations
const LOCAL_STORAGE_KEY = 'caceres_99_trips';
const DEFAULT_CENTER = [-16.0716, -57.6789]; // Cáceres - MT
const DEFAULT_ZOOM = 14;

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  loadSavedData();
  setupEventListeners();
  startGpsWatcher();
});

/**
 * Inicializa o Mapa Leaflet com estilo escuro e camada de calor
 */
function initMap() {
  // Tiles no estilo Dark Matter (CartoDB) para destaque do Mapa de Calor
  map = L.map('map', {
    zoomControl: false
  }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

  L.control.zoom({ position: 'topright' }).addTo(map);

  // Layer Escura CartoDB
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  // Inicializa a camada do Heatmap (leaflet-heat)
  heatLayer = L.heatLayer([], {
    radius: 25,
    blur: 15,
    maxZoom: 17,
    max: 1.0,
    gradient: {
      0.2: '#00ffff', // Ciano néon (Baixa intensidade)
      0.4: '#00ff66', // Verde néon
      0.6: '#ffea00', // Amarelo vibrante
      0.8: '#ff6b00', // Laranja 99
      1.0: '#ff0044'  // Vermelho fogueira (Pico de corridas)
    }
  }).addTo(map);

  // Grupo de marcadores
  markersGroup = L.layerGroup().addTo(map);
}

/**
 * Carrega dados do LocalStorage ou carrega demonstração se estiver vazio
 */
function loadSavedData() {
  const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (saved) {
    try {
      currentTrips = JSON.parse(saved);
    } catch (e) {
      console.error("Erro ao ler LocalStorage", e);
      currentTrips = generateCaceresDemoTrips(50);
      saveData();
    }
  } else {
    // Primeira utilização: Carrega 50 corridas demonstrativas reais de Cáceres
    currentTrips = generateCaceresDemoTrips(50);
    saveData();
  }

  updateMapAndStats();
}

/**
 * Salva a lista de corridas no LocalStorage do navegador
 */
function saveData() {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentTrips));
}

/**
 * Atualiza o mapa de calor, marcadores e painéis de estatísticas
 */
function updateMapAndStats() {
  const filteredTrips = getFilteredTrips();

  // 1. Atualizar Heatmap Data: [lat, lng, intensity]
  const heatPoints = filteredTrips.map(t => [t.lat, t.lng, 0.8]);
  heatLayer.setLatLngs(heatPoints);

  // 2. Atualizar Marcadores
  markersGroup.clearLayers();

  const showMarkers = document.getElementById('toggle-markers').checked;
  if (showMarkers) {
    filteredTrips.forEach(trip => {
      const customIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `<div style="
          background: #ff6b00;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          border: 2px solid #ffffff;
          box-shadow: 0 0 10px rgba(255,107,0,0.8);
        "></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      });

      const marker = L.marker([trip.lat, trip.lng], { icon: customIcon });
      
      marker.bindPopup(`
        <div style="font-family: var(--font-family); color: #0f172a; padding: 4px;">
          <h4 style="margin:0 0 4px 0; font-size:14px; color:#ff6b00;">📍 ${trip.notes || 'Embarque 99'}</h4>
          <p style="margin:2px 0; font-size:12px;"><b>Bairro:</b> ${trip.neighborhood || 'Cáceres'}</p>
          <p style="margin:2px 0; font-size:12px;"><b>Data:</b> ${trip.dateStr} às ${trip.timeStr}</p>
          ${trip.fare ? `<p style="margin:2px 0; font-size:12px; color:#10b981;"><b>Valor:</b> R$ ${trip.fare.toFixed(2)}</p>` : ''}
          <button onclick="deleteTrip('${trip.id}')" style="margin-top:6px; background:#ef4444; color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer;">Apagar Ponto</button>
        </div>
      `);

      markersGroup.addLayer(marker);
    });
  }

  // 3. Atualizar Lista do Histórico
  renderTripsList(filteredTrips);

  // 4. Calcular Estatísticas
  calculateStats(filteredTrips);
}

/**
 * Filtra as corridas por Período e Dia da Semana
 */
function getFilteredTrips() {
  const period = document.getElementById('filter-period').value;
  const day = document.getElementById('filter-day').value;

  return currentTrips.filter(trip => {
    // Filtro por Período do dia
    if (period !== 'all') {
      const h = trip.hour;
      if (period === 'morning' && (h < 6 || h >= 12)) return false;
      if (period === 'afternoon' && (h < 12 || h >= 18)) return false;
      if (period === 'night' && (h < 18 || h >= 24)) return false;
      if (period === 'dawn' && (h >= 6)) return false;
    }

    // Filtro por Dia da Semana
    if (day !== 'all') {
      if (trip.dayOfWeek.toString() !== day.toString()) return false;
    }

    return true;
  });
}

/**
 * Renderiza o histórico de corridas na barra lateral
 */
function renderTripsList(trips) {
  const container = document.getElementById('trips-list');
  if (trips.length === 0) {
    container.innerHTML = '<div style="text-align:center; color: var(--text-muted); font-size: 0.75rem; padding: 1rem;">Nenhum registro encontrado para esses filtros.</div>';
    return;
  }

  const sorted = [...trips].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const recent = sorted.slice(0, 15);

  container.innerHTML = recent.map(t => `
    <div class="trip-item">
      <div class="trip-item-info">
        <strong>${t.notes || 'Embarque GPS'}</strong>
        <span>${t.dateStr} às ${t.timeStr} • ${t.neighborhood || 'Cáceres'}</span>
      </div>
      <div class="trip-item-badge">${t.fare ? `R$ ${t.fare.toFixed(2)}` : 'Embarque'}</div>
    </div>
  `).join('');
}

/**
 * Calcula dados estatísticos
 */
function calculateStats(trips) {
  document.getElementById('stat-total-trips').innerText = trips.length;

  if (trips.length === 0) {
    document.getElementById('stat-top-zone').innerText = '--';
    document.getElementById('stat-peak-hour').innerText = '--';
    return;
  }

  // 1. Bairro + Quente
  const neighborhoodCounts = {};
  trips.forEach(t => {
    const neigh = t.neighborhood || 'Centro';
    neighborhoodCounts[neigh] = (neighborhoodCounts[neigh] || 0) + 1;
  });

  let topZone = '--';
  let maxZoneCount = 0;
  for (const [zone, count] of Object.entries(neighborhoodCounts)) {
    if (count > maxZoneCount) {
      maxZoneCount = count;
      topZone = zone;
    }
  }
  document.getElementById('stat-top-zone').innerText = topZone;

  // 2. Horário de Pico
  const hourCounts = Array(24).fill(0);
  trips.forEach(t => {
    if (t.hour !== undefined) hourCounts[t.hour]++;
  });

  let peakHour = 0;
  let maxHourCount = 0;
  hourCounts.forEach((count, hr) => {
    if (count > maxHourCount) {
      maxHourCount = count;
      peakHour = hr;
    }
  });

  document.getElementById('stat-peak-hour').innerText = `${String(peakHour).padStart(2, '0')}:00h`;
}

let userLiveMarker = null;

/**
 * Captura a localização via GPS em Tempo Real com tolerância e fallback de precisão
 */
function triggerGpsCapture() {
  const statusText = document.getElementById('gps-status-text');
  statusText.innerText = "Buscando Sinal GPS...";

  if (!navigator.geolocation) {
    alert("Geolocalização não é suportada pelo navegador do seu dispositivo.");
    statusText.innerText = "GPS não suportado";
    return;
  }

  // Tenta primeiro com Alta Precisão (GPS de Satélite)
  navigator.geolocation.getCurrentPosition(
    (position) => handleGpsSuccess(position),
    (error) => {
      console.warn("Tentativa de Alta Precisão falhou, tentando precisão padrão:", error.message);
      // Segunda tentativa com precisão padrão (Rede/Wi-Fi/Torre de Celular)
      navigator.geolocation.getCurrentPosition(
        (position) => handleGpsSuccess(position),
        (err2) => handleGpsError(err2),
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 30000 }
      );
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
  );
}

/**
 * Consulta APIs de Geocoding Reverso (OpenStreetMap Nominatim + BigDataCloud)
 * para obter o NOME REAL da Rua e Bairro onde o motorista está em Cáceres.
 */
async function fetchRealAddressFromGps(lat, lng) {
  // 1. Primeira Tentativa: OpenStreetMap Nominatim (Endereço detalhado por rua)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept-Language': 'pt-BR' }
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const addr = data.address || {};

      const road = addr.road || addr.pedestrian || addr.street || addr.residential || addr.path || '';
      const suburb = addr.suburb || addr.neighbourhood || addr.city_district || addr.quarter || addr.subdivision || '';
      const city = addr.town || addr.city || 'Cáceres';

      let nameStr = '';
      if (road && suburb && road.toLowerCase() !== suburb.toLowerCase()) {
        nameStr = `${road} - ${suburb}`;
      } else if (road) {
        nameStr = `${road} (${city})`;
      } else if (suburb) {
        nameStr = `${suburb} (${city})`;
      }

      if (nameStr) {
        return {
          name: nameStr,
          neighborhood: suburb || city || 'Cáceres'
        };
      }
    }
  } catch (e) {
    console.warn("Consulta ao OpenStreetMap falhou, tentando backup:", e);
  }

  // 2. Segunda Tentativa: BigDataCloud Reverse Geocoding
  try {
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=pt`);
    if (res.ok) {
      const data = await res.json();
      const locName = data.locality || data.city || 'Cáceres';
      return {
        name: `Rua em ${locName}`,
        neighborhood: locName
      };
    }
  } catch (e2) {
    console.warn("Consulta ao BigDataCloud falhou:", e2);
  }

  // 3. Fallback Seguro com Coordenadas Reais (NUNCA usa locais estáticos simulados)
  return {
    name: `Embarque GPS (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
    neighborhood: 'Cáceres'
  };
}

async function handleGpsSuccess(position) {
  const statusText = document.getElementById('gps-status-text');
  const lat = Number(position.coords.latitude.toFixed(6));
  const lng = Number(position.coords.longitude.toFixed(6));
  const acc = Math.round(position.coords.accuracy || 10);
  const now = new Date();

  pendingGpsLocation = { lat, lng };
  statusText.innerText = `Buscando rua e bairro exatos em Cáceres...`;

  // Atualizar pino do motorista
  updateUserLiveMarker(lat, lng);

  // Centralizar mapa suavemente no ponto real do motorista
  map.flyTo([lat, lng], 16, { animate: true, duration: 1.2 });

  // Obter o NOME REAL da Rua e Bairro de Cáceres via Geocoding
  const locationInfo = await fetchRealAddressFromGps(lat, lng);
  statusText.innerText = `GPS Conectado (~${acc}m de precisão)`;

  // Criar nova corrida salva DIRETAMENTE no Mapa de Calor com Endereço REAL
  const newTrip = {
    id: "trip-" + Date.now(),
    lat: lat,
    lng: lng,
    notes: locationInfo.name || 'Embarque GPS 99',
    neighborhood: locationInfo.neighborhood || 'Cáceres',
    fare: null,
    timestamp: now.toISOString(),
    dateStr: now.toLocaleDateString('pt-BR'),
    timeStr: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    hour: now.getHours(),
    dayOfWeek: now.getDay()
  };

  // Salvar no LocalStorage e atualizar Heatmap na hora!
  currentTrips.push(newTrip);
  saveData();
  updateMapAndStats();

  // Mostrar Notificação Flutuante (Toast) com NOME REAL DA RUA E BAIRRO
  showToastNotification(`🔥 Embarque gravado: ${locationInfo.name}`);
}

/**
 * Exibe notificação flutuante rápida de confirmação na tela
 */
function showToastNotification(message) {
  let toast = document.getElementById('app-toast-notification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast-notification';
    toast.style.cssText = `
      position: fixed;
      top: 75px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #ff6b00, #ff2200);
      color: #ffffff;
      padding: 0.75rem 1.25rem;
      border-radius: 30px;
      font-weight: 700;
      font-size: 0.85rem;
      box-shadow: 0 8px 25px rgba(255, 107, 0, 0.6);
      z-index: 10000;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    `;
    document.body.appendChild(toast);
  }

  toast.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>${message}</span>`;
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(-20px)';
  }, 3500);
}

function handleGpsError(error) {
  const statusText = document.getElementById('gps-status-text');
  console.warn("Erro final no GPS:", error);

  let msg = "Não foi possível obter a posição atual.";
  if (error.code === 1) { // PERMISSION_DENIED
    msg = "Permissão de GPS negada. Por favor, clique no ícone de CADEADO 🔒 ao lado do link e escolha 'PERMITIR'.";
  } else if (error.code === 2) { // POSITION_UNAVAILABLE
    msg = "Sinal de GPS indisponível no momento (verifique se a localização do celular está ativa).";
  } else if (error.code === 3) { // TIMEOUT
    msg = "Tempo limite atingido para buscar o GPS. Verifique se está em local aberto.";
  }

  alert("⚠️ " + msg);
  statusText.innerText = "GPS Indisponível - Verifique as permissões";
}

function updateUserLiveMarker(lat, lng) {
  if (userLiveMarker) {
    userLiveMarker.setLatLng([lat, lng]);
  } else {
    const carIcon = L.divIcon({
      className: 'driver-live-pin',
      html: `<div style="
        background: #06b6d4;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        border: 3px solid #ffffff;
        box-shadow: 0 0 15px #06b6d4;
        animation: pulseGlow 1.5s infinite;
      "></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });
    userLiveMarker = L.marker([lat, lng], { icon: carIcon }).addTo(map);
    userLiveMarker.bindTooltip("Sua Localização Atual", { permanent: false, direction: 'top' });
  }
}

/**
 * Monitora o GPS continuamente em segundo plano
 */
function startGpsWatcher() {
  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const acc = Math.round(pos.coords.accuracy);
        
        document.getElementById('gps-status-text').innerText = `GPS Ativo (~${acc}m)`;
        updateUserLiveMarker(lat, lng);
      },
      (err) => {},
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }
    );
  }
}

/**
 * Abre o Modal para registrar corrida
 */
function openPickupModal(lat, lng) {
  const modal = document.getElementById('modal-new-pickup');
  document.getElementById('modal-coord-text').innerText = `Lat: ${lat}, Lng: ${lng}`;

  // Tentar identificar o bairro mais próximo em Cáceres
  const closestPoi = findClosestCaceresPoi(lat, lng);
  document.getElementById('modal-address-text').innerText = `Embarque detectado em: ${closestPoi.name}`;
  document.getElementById('pickup-notes').value = closestPoi.name;

  const now = new Date();
  document.getElementById('pickup-time').value = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

  document.getElementById('pickup-fare').value = '';
  modal.classList.add('active');
}

function closePickupModal() {
  document.getElementById('modal-new-pickup').classList.remove('active');
  pendingGpsLocation = null;
}

/**
 * Encontra o Ponto de Referência mais próximo em Cáceres
 */
function findClosestCaceresPoi(lat, lng) {
  let minDistance = Infinity;
  let closest = { name: "Cáceres - MT", neighborhood: "Centro" };

  CACERES_POIS.forEach(poi => {
    const dist = Math.hypot(poi.lat - lat, poi.lng - lng);
    if (dist < minDistance) {
      minDistance = dist;
      closest = poi;
    }
  });

  return closest;
}

/**
 * Salva a nova corrida capturada no mapa
 */
function savePickupFromModal() {
  if (!pendingGpsLocation) return;

  const notes = document.getElementById('pickup-notes').value || 'Embarque GPS 99';
  const fareVal = parseFloat(document.getElementById('pickup-fare').value);
  const now = new Date();

  const closestPoi = findClosestCaceresPoi(pendingGpsLocation.lat, pendingGpsLocation.lng);

  const newTrip = {
    id: "trip-" + Date.now(),
    lat: pendingGpsLocation.lat,
    lng: pendingGpsLocation.lng,
    notes: notes,
    neighborhood: closestPoi.neighborhood || 'Centro',
    fare: isNaN(fareVal) ? null : fareVal,
    timestamp: now.toISOString(),
    dateStr: now.toLocaleDateString('pt-BR'),
    timeStr: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    hour: now.getHours(),
    dayOfWeek: now.getDay()
  };

  currentTrips.push(newTrip);
  saveData();
  updateMapAndStats();
  closePickupModal();

  // Feedback Visual
  alert("✅ Embarque registrado com sucesso! O Mapa de Calor foi atualizado.");
}

/**
 * Remove um ponto do mapa
 */
function deleteTrip(id) {
  currentTrips = currentTrips.filter(t => t.id !== id);
  saveData();
  updateMapAndStats();
  map.closePopup();
}

/**
 * Event Listeners & Controles da Interface
 */
function setupEventListeners() {
  // Botões de Ação Principal
  document.getElementById('btn-quick-gps').addEventListener('click', triggerGpsCapture);
  document.getElementById('btn-floating-capture').addEventListener('click', triggerGpsCapture);

  // Modal actions
  document.getElementById('btn-close-modal').addEventListener('click', closePickupModal);
  document.getElementById('btn-cancel-pickup').addEventListener('click', closePickupModal);
  document.getElementById('btn-save-pickup').addEventListener('click', savePickupFromModal);

  // Filtros
  document.getElementById('filter-period').addEventListener('change', updateMapAndStats);
  document.getElementById('filter-day').addEventListener('change', updateMapAndStats);

  // Toggles de visualização
  document.getElementById('toggle-heatmap').addEventListener('change', (e) => {
    if (e.target.checked) {
      map.addLayer(heatLayer);
    } else {
      map.removeLayer(heatLayer);
    }
  });

  document.getElementById('toggle-markers').addEventListener('change', updateMapAndStats);

  // Sliders do Heatmap
  document.getElementById('heat-radius').addEventListener('input', (e) => {
    const val = e.target.value;
    document.getElementById('radius-val').innerText = `${val}px`;
    heatLayer.setOptions({ radius: parseInt(val) });
  });

  document.getElementById('heat-blur').addEventListener('input', (e) => {
    const val = e.target.value;
    document.getElementById('blur-val').innerText = `${val}px`;
    heatLayer.setOptions({ blur: parseInt(val) });
  });

  // Gerenciamento de Dados
  document.getElementById('btn-load-demo').addEventListener('click', () => {
    if (confirm("Deseja gerar 60 dados demonstrativos de corridas em Cáceres-MT?")) {
      currentTrips = [...currentTrips, ...generateCaceresDemoTrips(60)];
      saveData();
      updateMapAndStats();
    }
  });

  document.getElementById('btn-clear-data').addEventListener('click', () => {
    if (confirm("⚠️ Tem certeza que deseja apagar todos os registros de corridas salvos?")) {
      currentTrips = [];
      saveData();
      updateMapAndStats();
    }
  });

  // Exportar CSV
  document.getElementById('btn-export-csv').addEventListener('click', exportToCsv);

  // Importar JSON
  const fileInput = document.getElementById('file-input');
  document.getElementById('btn-import-json').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', importFromJson);

  // Toggle Sidebar on mobile
  document.getElementById('btn-toggle-stats').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  document.getElementById('btn-toggle-settings').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
}

/**
 * Exporta os dados das corridas em formato CSV
 */
function exportToCsv() {
  if (currentTrips.length === 0) {
    alert("Não há dados para exportar.");
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,ID,Latitude,Longitude,Local_Obs,Bairro,Valor_R$,Data,Hora,Dia_Semana\n";

  currentTrips.forEach(t => {
    const line = [
      t.id,
      t.lat,
      t.lng,
      `"${(t.notes || '').replace(/"/g, '""')}"`,
      `"${t.neighborhood || ''}"`,
      t.fare || '',
      t.dateStr,
      t.timeStr,
      t.dayOfWeek
    ].join(",");
    csvContent += line + "\n";
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `caceres_99_corridas_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Importa dados de arquivo JSON
 */
function importFromJson(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (Array.isArray(data)) {
        currentTrips = data;
        saveData();
        updateMapAndStats();
        alert("✅ Backup importado com sucesso!");
      } else {
        alert("Formato de arquivo inválido. Deve ser um array de corridas.");
      }
    } catch (err) {
      alert("Erro ao ler o arquivo JSON: " + err.message);
    }
  };
  reader.readAsText(file);
}
