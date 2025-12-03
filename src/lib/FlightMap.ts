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
  departureTime: string;

  posLat: number;
  posLng: number;

  prevLat: number;
  prevLng: number;
}

export interface FlightPosDTO {
  lat: number,
  lng: number,
  time: string // ISO string from backend
}

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-rotatedmarker";
import * as turf from "@turf/turf";

const airplaneIcon = L.icon({
  iconUrl: "airplane.png",
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  className: "airplane-icon",
});

const airportIcon = L.icon({
  iconUrl: "airport.png",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  className: "airport-icon",
});

export class FlightMap {
  private map: L.Map;
  private flightsLayer: L.LayerGroup;
  private trackLayer: L.LayerGroup;

  private flightsCache = new Map<number, [FlightDTO, L.Marker]>(); // Cache

  constructor(mapId: string) {
    this.map = L.map(mapId).setView([43.0, 27.1278], 6); // Marmara
    this.initMap();
    this.flightsLayer = L.layerGroup().addTo(this.map);
    this.trackLayer = L.layerGroup().addTo(this.map);

    this.initMapClickHandler();
  }

  private getRotation(prev: [number, number], next: [number, number]) {
    const [lat1, lon1] = prev;
    const [lat2, lon2] = next;

    // Bearing formula (atan2)
    const angleRad = Math.atan2(lon2 - lon1, lat2 - lat1);

    // Convert to degrees
    let angleDeg = angleRad * 180 / Math.PI;
    angleDeg = angleDeg + 135 + 180;  

    // Normalize
    if (angleDeg < 0) angleDeg += 360;

    return angleDeg;
  }

  private initMapClickHandler(){
    const infoPane = document.getElementById("flight-info");
    if (!infoPane) return;

    this.map.on("click", () => {
      infoPane.classList.add("hidden");
      this.clearFlightPath();
    })
  }

  private async getFlightPath(id: Number, isoDateTime: string, maxArraySize: number = 300){
    const URL = `http://localhost:8080/api/flights/${id}/positions?dateTime=${encodeURIComponent(isoDateTime)}&maxSize=${encodeURIComponent(maxArraySize)}`;

    try {
      const res = await fetch(URL);
      if (!res.ok) {
        console.error(
          "Failed to fetch positions from: ",
          URL,
          res.status,
          await res.text()
        );
        return;
      }
      const positions = await res.json();
      console.log(`Fetched ${positions.length} positions`);
      return positions;
    } catch (err) {
      console.error("Error loading flight positions");
    }
  }

  private drawFlightPath(posArr: FlightPosDTO[], dto: FlightDTO){
    this.clearFlightPath();
    if(!posArr.length) return;

    // 1. Previous Path
    const prevCoords = posArr.map(p => [p.lat, p.lng]);

    L.polyline(prevCoords, {
      weight: 3,
      color: "#00aaff",
      opacity: 0.9,
    }).addTo(this.trackLayer);

    // 2. Plane to Dest
    const from = turf.point([dto.posLng, dto.posLat]); // [lng, lat]
    const to   = turf.point([dto.endLng, dto.endLat]);
    const gc = turf.greatCircle(from, to, { npoints: 64 });

    L.geoJSON(gc, {
      style: {
        weight: 2,
        opacity: 0.8,
        dashArray: "4 6", // dashed
      },
    }).addTo(this.trackLayer);
  }

  private clearFlightPath(){
    this.trackLayer.clearLayers();
  }

  public addFlight(dto: FlightDTO) {
    const pos: [number, number] = [dto.posLat, dto.posLng];
    const prev: [number, number] = [dto.prevLat, dto.prevLng];

    const entry = this.flightsCache.get(dto.id);
    if (!entry) { // Not in cache
      const planeMarker = L.marker(pos, {
        icon: airplaneIcon,
        rotationOrigin: "center center",
        rotationAngle: this.getRotation(prev, pos),
      })
      .addTo(this.flightsLayer)
      .bindTooltip(
        `
        <strong>id:</strong> ${dto.id}<br/>
        `
      );

      const infoPane = document.getElementById("flight-info");

      planeMarker.on("click", async () => {
        if (!infoPane) return;

        const entry = this.flightsCache.get(dto.id);
        if (!entry) {console.log("Cache seems corrupted"); return}
        const latest = entry[0];

        infoPane.classList.remove("hidden");
        infoPane.innerHTML = `
          <h2>Flight id ${latest.id}</h2>
          <p><strong>Aircraft:</strong> Unspecified</p>
          <p><strong>From:</strong> ${latest.startLocationName}</p>
          <p><strong>To:</strong> ${latest.endLocationName}</p>
          <p><strong>Departed at:</strong> ${latest.departureTime} UTC</p>
          <p><strong>Last update:</strong> ${latest.lastUpdatedAt} UTC</p>
          <p><strong>Coordinates:</strong> (${latest.posLat}, ${latest.posLng})</p>
        `;

        const positions: FlightPosDTO[] = await this.getFlightPath(latest.id, latest.lastUpdatedAt);
        this.drawFlightPath(positions, latest);
      });

      // Add to cache
      this.flightsCache.set(dto.id, [dto, planeMarker]);
    } else { // Flight was already rendered, update the marker with new coords
      const marker = entry[1];
      marker.setLatLng(pos);
      marker.setRotationAngle(this.getRotation(prev, pos));
      entry[0] = dto;
    }
  }

  public async loadFlightsAt(isoDateTime: string) {
    console.log("Cache Values: ", this.flightsCache.keys().toArray().toString());
    const URL = `http://localhost:8080/api/flights?dateTime=${encodeURIComponent(isoDateTime)}`;

    try {
      const res = await fetch(URL);
      if (!res.ok) {
        console.error(
          "Failed to fetch flights from: ",
          URL,
          res.status,
          await res.text()
        );
        return;
      }

      const flights = await res.json();
      console.log(flights);

      const sent = new Array<number>();
      
      const toDelete = new Array<number>();

      flights.forEach((flight: FlightDTO) => {
        console.log(flight.lastUpdatedAt);
        this.addFlight({ ...flight });
        sent.push(flight.id);
      });
      console.log("Sent values:", sent.values().toArray().toString())

      // Delete flights from the cache which have not been sent this time by the backend
      for (const cachedId of this.flightsCache.keys()) {
        if (!sent.includes(cachedId)){
          console.log("Deleting an entry from cache");
          // delete the marker
          const marker = this.flightsCache.get(cachedId)?.[1];
          if (!marker) {console.error("Cache seems corrupted"); return}
          marker.remove();
          this.flightsCache.delete(cachedId);
        }
      }

    } catch (err) {
      console.error("Error loading flights", err);
    }
  }

  public addAirport(name: string, lat: number, lng: number) {
    const loc: [number, number] = [lat, lng];

    L.marker(loc, { icon: airportIcon })
      .addTo(this.map)
      .bindPopup(name, { offset: L.point(0, -33) });
  }

  public async loadAirports() {
    const URL = "http://localhost:8080/api/airports";
    try {
      const res = await fetch(URL);
      if (!res.ok) {
        console.error(
          "Failed to fetch airports:",
          res.status,
          await res.text()
        );
        return;
      }

      const airports = await res.json();
      // Expected format:
      // [{ lat: 51.4706, lng: -0.461941, name: "London Heathrow Airport" }, ...]

      airports.forEach((a: { lat: number; lng: number; name: string; }) => {
        if (typeof a.lat !== "number" || typeof a.lng !== "number") return;
        this.addAirport(a.name, a.lat, a.lng);
      });
    } catch (err) {
      console.error("Error loading airports", err);
    }
  }

  private initMap() {
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(this.map);
  }
}
