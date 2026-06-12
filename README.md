# 🌍 AQI Insight

**Real-Time Air Quality Intelligence & Monitoring Platform**

AQI Insight is a full-stack environmental monitoring system that simulates a fleet of autonomous drones collecting air quality data across a monitored region. The platform visualizes live telemetry, generates pollution heatmaps, tracks AQI trends in real time, and provides actionable environmental insights through an interactive dashboard.

---

## 🚀 Overview

AQI Insight combines real-time telemetry streaming, geospatial visualization, and environmental analytics into a single platform.

The system consists of:

* **FastAPI backend** for data ingestion and WebSocket communication
* **React + Vite frontend** for interactive visualization
* **Leaflet-powered maps** for geospatial monitoring
* **Recharts analytics dashboard** for AQI trend analysis
* **SQLAlchemy-powered persistence layer**
* **Drone telemetry simulator** for testing and demonstrations

---

## ✨ Key Features

### 📡 Real-Time Drone Telemetry

Monitor multiple drones simultaneously as they stream live location and AQI readings.

### 🗺️ Interactive Air Quality Heatmaps

Visualize pollution intensity using dynamically generated heatmaps over monitored zones.

### 📈 Live AQI Analytics

Track AQI fluctuations over time through responsive charts and trend visualizations.

### ⚠️ Hazard Detection & Alerts

Automatically identify dangerous AQI levels and trigger environmental warnings.

### 🔄 WebSocket-Based Live Updates

Receive real-time telemetry without page refreshes.

### 💾 Historical Data Storage

Persist telemetry records for future analysis and reporting.

### 🤖 Drone Simulation Engine

Generate realistic telemetry streams for testing and demonstrations.

---

## 🏗️ System Architecture

```text
Drone Simulator
       │
       ▼
FastAPI Backend
       │
       ├── SQLAlchemy Database Layer
       │
       └── WebSocket Broadcast
               │
               ▼
      React Dashboard
               │
       ├── Leaflet Maps
       ├── Heatmap Layer
       └── AQI Analytics
```

---

## 🛠️ Tech Stack

### Frontend

* React 19
* Vite
* Tailwind CSS
* Leaflet
* React Leaflet
* Leaflet Heatmap
* Recharts

### Backend

* FastAPI
* Uvicorn
* WebSockets
* SQLAlchemy (Async)

### Database

* SQLite (Async via aiosqlite)

### Scientific Computing

* NumPy
* SciPy

---

## 📂 Project Structure

```text
AQI-Insight/
│
├── backend/
│   ├── server.py
│   ├── database.py
│   ├── drone_simulator.py
│   ├── idw_engine.py
│   └── docker-compose.yml
│
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
│
├── README.md
└── requirements.txt
```

---

## ⚙️ Installation

### Clone Repository

```bash
git clone https://github.com/yourusername/AQI-Insight.git
cd AQI-Insight
```

---

### Backend Setup

```bash
cd backend

python -m venv venv

# Windows
venv\Scripts\activate

pip install -r requirements.txt
```

Run the API server:

```bash
python server.py
```

Backend will start at:

```text
http://localhost:8000
```

---

### Frontend Setup

```bash
cd frontend

npm install
npm run dev
```

Frontend will start at:

```text
http://localhost:5173
```

---

## 📦 Backend Requirements

```text
fastapi
uvicorn
sqlalchemy
aiosqlite
numpy
scipy
websockets
```

---

## 🔌 API Endpoints

### REST Endpoints

| Method | Endpoint               | Description                       |
| ------ | ---------------------- | --------------------------------- |
| GET    | /api/telemetry/history | Retrieve historical AQI data      |
| GET    | /api/heatmap           | Get processed heatmap information |

### WebSocket

```text
ws://localhost:8000/ws/telemetry
```

Provides real-time drone telemetry and AQI updates.

---

## 📊 Sample Telemetry Payload

```json
{
  "timestamp": "2026-06-12T14:32:00Z",
  "drones": {
    "DRONE-01": {
      "lat": 29.8649,
      "lng": 77.8966,
      "aqi": 87
    }
  }
}
```

---

## 🎯 Learning Outcomes

This project demonstrates:

* Full-Stack Development
* Real-Time Systems
* WebSocket Communication
* Geospatial Data Visualization
* Environmental Analytics
* Async Backend Architecture
* Data Persistence & Querying

---

## 📜 License

MIT License

---

### Developed as a real-time environmental intelligence platform for monitoring and visualizing air quality through autonomous sensing systems.
