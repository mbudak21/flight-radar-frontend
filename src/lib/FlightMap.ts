// Enable IDE typing for leaflet-rotatedmarker
declare module "leaflet" {
  interface MarkerOptions {
    rotationAngle?: number;
    rotationOrigin?: string;
  }

  interface Marker {
    setRotationAngle(angle: number): this;
    setRotationOrigin(origin: string): this;
  }
}

export interface FlightDTO {
  id: number;

  startLat: number;
  startLng: number;
  startLocationName: string;

  endLat: number;
  endLng: number;
  endLocationName: string;

  lastUpdatedAt: string; // ISO string from backend

  posLat: number;
  posLng: number;

  prevLat: number;
  prevLng: number;
}


import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-rotatedmarker";

const airplaneIcon = L.icon({
  iconUrl: "airplane.png",
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  className: "airplane-icon"
});

const airportIcon = L.icon({
  iconUrl: "airport.png",
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  className: "airport-icon"
});

export class FlightMap {
  private map: L.Map;
  private mapId: string;
  private flightsLayer: L.LayerGroup;


  constructor(mapId: string) {
    this.mapId = mapId;
    this.map = L.map(mapId).setView([43.0, 27.1278], 6); // Marmara
    this.initMap();
    this.flightsLayer = L.layerGroup().addTo(this.map);
  }

  public addFlight(dto: FlightDTO){

    const start: [number, number] = [dto.startLat, dto.startLng];
    const end:   [number, number] = [dto.endLat, dto.endLng];
    const pos:   [number, number] = [dto.posLat, dto.posLng];
    const prev:  [number, number] = [dto.prevLat, dto.prevLng];

    // // 1. Start Marker
    // L.marker(start, { icon: airportIcon })
    //   .addTo(this.map)
    //   .bindPopup(startName, { offset: L.point(0, -33) });

    // // 2. End Marker
    // L.marker(end, { icon: airportIcon })
    //   .addTo(this.map)
    //   .bindPopup(endName, { offset: L.point(0, -33) });

    // 3. Plane Marker
    L.marker(pos, {
      icon: airplaneIcon,
      rotationOrigin: "center center",
      rotationAngle: -86
    })
      .addTo(this.flightsLayer)
      .bindPopup(
        `<strong>${dto.startLocationName} → ${dto.endLocationName}</strong><br/>Last update: ${dto.lastUpdatedAt}`,
        { offset: L.point(0, -8) }
      );

    // 4. Line from start to Plane
    L.polyline([start, pos], {
      color: "red",
      weight: 3,
      opacity: 0.8,
    }).addTo(this.flightsLayer);

    // 5. Line from Plane to End
    L.polyline([pos, end], {
      color: "red",
      weight: 2,
      opacity: 0.8,
      dashArray: "4 4"
      
    }).addTo(this.flightsLayer);
  }

  public async loadFlightsAt(isoDateTime: string){
    this.clearFlights();
    const API_URL = `http://localhost:8080/api/flights?dateTime=${encodeURIComponent(isoDateTime)}`;

    try{
      const res = await fetch(API_URL);
      if (!res.ok){
        console.error("Failed to fetch flights from: ", API_URL, res.status, await res.text());
        return;
      }

      const flights = await res.json();
      console.log(flights);

      flights.forEach(flight => {
        console.log(flight.lastUpdatedAt);
        this.addFlight({...flight, lastUpdate: new Date(flight.lastUpdatedAt)});
      });

    } catch (err) {
      console.error("Error loading flights", err);
    }
  }

  public clearFlights() {
    this.flightsLayer.clearLayers();
  }


  public addAirport(name: string, lat: number, lng: number) {


    const loc: [number, number] = [lat, lng]

    L.marker(loc, {icon: airportIcon})
      .addTo(this.map)
      .bindPopup(name, {offset: L.point(0, -33)})
  }

  public async loadAirports() {
    const API_URL = 'http://localhost:8080/api/airports';
    try {
      const res = await fetch(API_URL);
      if (!res.ok) {
        console.error('Failed to fetch airports:', res.status, await res.text());
        return;
      }

      const airports = await res.json();
      // Expected format:
      // [{ lat: 51.4706, lng: -0.461941, name: "London Heathrow Airport" }, ...]

      airports.forEach((a) => {
        if (typeof a.lat !== 'number' || typeof a.lng !== 'number') return;
        this.addAirport(a.name, a.lat, a.lng)
      });
    } catch (err) {
      console.error('Error loading airports', err);
    }
  }


  private initMap() {
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(this.map);

    // L.marker([51.5074, -0.1278])
    //   .addTo(this.map)
    //   .bindPopup("London (LHR)")
    //   .openPopup();

    // const points: [number, number][] = [
    //   [40.7128, -74.0060], // New York
    //   [51.5074, -0.1278],  // London
    // ];


    // L.polyline(points, {
    //   color: "red",
    //   weight: 4,
    //   opacity: 0.8
    // }).addTo(this.map);

    // const planeIcon = L.icon({
    //   iconUrl: "airplane.png",
    //   iconSize: [40, 40],
    //   iconAnchor: [20, 20],
    //   className: "plane-icon"
    // });

    // const planeMarker = L.marker([51.5074, -0.1278], { 
    //   icon: planeIcon,
    //   rotationAngle: 100,
    //   rotationOrigin: "center center"
    // })
    // .bindPopup("AirBus A380")
    // .addTo(this.map);

    // const infoPane = document.getElementById("flight-info");

    // planeMarker.on("click", () => {
    // if (!infoPane) return;

    // infoPane.classList.remove("hidden");
    // infoPane.innerHTML = `
    //   <h2>Flight BA 117</h2>
    //   <p><strong>Aircraft:</strong> Airbus A380</p>
    //   <p><strong>From:</strong> New York (JFK)</p>
    //   <p><strong>To:</strong> London (LHR)</p>
    //   <p><strong>Altitude:</strong> 34,000 ft</p>
    //   <p><strong>Speed:</strong> 910 km/h</p>
    // `;
    // });

    // this.map.on("click", (e) => {
    // if (!infoPane) return;
    // infoPane.classList.add("hidden");
    // });
  }
}
