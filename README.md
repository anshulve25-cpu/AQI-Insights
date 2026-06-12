# AQI Monitor Station

Real-time air quality monitoring command center built for the IIT Roorkee campus. 
A fleet of simulated UAVs patrol campus zones, streaming live spatial telemetry 
to a centralized dashboard.

---

## What It Does

Three drones continuously stream GPS coordinates and AQI readings (PM2.5, PM10, NO₂) 
to a FastAPI backend. The backend runs IDW interpolation on incoming data and 
broadcasts a pollution heatmap to the React dashboard over WebSockets — updated 
every second.

When any zone crosses AQI 140, the dashboard triggers an evacuation advisory 
and locks the UI into hazard mode.

---

## Architecture

    drone_simulator.py  →  FastAPI (WebSocket)  →  PostgreSQL
                                                ↓
                                       IDW Math Engine (SciPy)
                                                ↓
                                 React Dashboard (Leaflet + Canvas)

- **`drone_simulator.py`** — tethered random-walk physics per UAV, Gaussian noise on AQI values
- **`server.py`** — async WebSocket broadcast + non-blocking DB writes via `asyncio.create_task`
- **`idw_engine.py`** — Inverse Distance Weighting on a 50x50 grid across campus bounds
- **`App.jsx`** — direct Leaflet DOM mutation via `useRef` (bypasses React state for 60fps marker updates)

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite, TailwindCSS, React-Leaflet, Recharts |
| Backend | FastAPI, SQLAlchemy (async), Uvicorn |
| Math | SciPy, NumPy |
| Database | PostgreSQL 15 |
| Infrastructure | Docker, Docker Compose |

---

## Setup

Make sure Docker Desktop is running, then:

    # 1. Start the database
    docker-compose up -d

    # 2. Install backend dependencies
    pip install -r requirements.txt

    # 3. Start the FastAPI server
    uvicorn server:app --reload

    # 4. In a separate terminal, start the simulator
    python drone_simulator.py

    # 5. Start the frontend
    cd frontend && npm install && npm run dev

*Open `http://localhost:5173`. The dashboard will show SYSTEM OFFLINE until the simulator connects — this is expected.*

---

### Notes
* Drone anchors are set to real IIT Roorkee coordinates (Hydrology Dept, LHC, James Thomason Bldg).
* DRONE-01 is hardcoded to the hazard zone (AQI 110–150) to demonstrate alert protocols.
* CSV export from the dashboard captures the last 30s of telemetry per drone.