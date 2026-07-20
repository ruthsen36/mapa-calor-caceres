// Pontos de Referência de Cáceres - MT e Gerador de Dados Demonstrativos para Motoristas 99

const CACERES_CENTER = [-16.0716, -57.6789]; // Praça Barão do Rio Branco

const CACERES_POIS = [
  { name: "Praça Barão do Rio Branco (Centro)", lat: -16.0716, lng: -57.6789, weight: 1.0, neighborhood: "Centro" },
  { name: "Rodoviária de Cáceres", lat: -16.0682, lng: -57.6705, weight: 0.95, neighborhood: "Centro" },
  { name: "UNEMAT - Cidade Universitária", lat: -16.0825, lng: -57.6850, weight: 0.9, neighborhood: "DNER/UNEMAT" },
  { name: "Faculdade FAPAN", lat: -16.0592, lng: -57.6684, weight: 0.85, neighborhood: "DNER" },
  { name: "Hospital Regional de Cáceres", lat: -16.0761, lng: -57.6752, weight: 0.9, neighborhood: "Santos Dumont" },
  { name: "Hospital São Luiz", lat: -16.0735, lng: -57.6795, weight: 0.8, neighborhood: "Centro" },
  { name: "Bairro Cavalhada (Praça da Cavalhada)", lat: -16.0645, lng: -57.6822, weight: 0.75, neighborhood: "Cavalhada" },
  { name: "Av. São Luiz (Comércio / Atacadão)", lat: -16.0618, lng: -57.6625, weight: 0.85, neighborhood: "São Luiz" },
  { name: "Feira Produtor Rural / Ceasa", lat: -16.0700, lng: -57.6740, weight: 0.7, neighborhood: "Centro" },
  { name: "Bairro Cohab (Av. Principal)", lat: -16.0520, lng: -57.6760, weight: 0.75, neighborhood: "Cohab" },
  { name: "Bairro Maracanã / EMPA", lat: -16.0852, lng: -57.6695, weight: 0.7, neighborhood: "Maracanã" },
  { name: "Jardim Popular", lat: -16.0790, lng: -57.6610, weight: 0.65, neighborhood: "Jardim Popular" },
  { name: "Praça do DNER / Trevo BR-070", lat: -16.0535, lng: -57.6650, weight: 0.8, neighborhood: "DNER" }
];

/**
 * Gera um conjunto de dados simulados de corridas em Cáceres
 * espalhados ao longo de horários do dia e bairros reais.
 */
function generateCaceresDemoTrips(count = 60) {
  const trips = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    // Seleciona um POI com variação aleatória de GPS (raio de ~200m)
    const poi = CACERES_POIS[Math.floor(Math.random() * CACERES_POIS.length)];
    
    // Pequeno deslocamento aleatório para simular rua exata
    const latOffset = (Math.random() - 0.5) * 0.0045;
    const lngOffset = (Math.random() - 0.5) * 0.0045;
    
    const lat = Number((poi.lat + latOffset).toFixed(6));
    const lng = Number((poi.lng + lngOffset).toFixed(6));
    
    // Simula horário aleatório nos últimos 7 dias
    const daysAgo = Math.floor(Math.random() * 7);
    const hour = Math.floor(Math.random() * 24);
    const minute = Math.floor(Math.random() * 60);
    
    const tripDate = new Date(now);
    tripDate.setDate(tripDate.getDate() - daysAgo);
    tripDate.setHours(hour, minute, 0, 0);
    
    const fare = (10 + Math.random() * 25).toFixed(2);
    
    trips.push({
      id: "demo-" + Math.random().toString(36).substr(2, 9),
      lat: lat,
      lng: lng,
      notes: `Embarque próximo: ${poi.name}`,
      neighborhood: poi.neighborhood,
      fare: parseFloat(fare),
      timestamp: tripDate.toISOString(),
      dateStr: tripDate.toLocaleDateString('pt-BR'),
      timeStr: tripDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      hour: hour,
      dayOfWeek: tripDate.getDay() // 0=Dom, 1=Seg...
    });
  }
  
  return trips;
}
