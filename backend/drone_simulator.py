import asyncio
import websockets
import json
import random
import numpy as np
from scipy.spatial.distance import cdist
from datetime import datetime, timezone
ANCHORS = {
    "DRONE-01": [29.8690, 77.8955],
    "DRONE-02": [29.8632, 77.8995],
    "DRONE-03": [29.8652, 77.8990]
}

drones_state = {
    "DRONE-01": {"lat": ANCHORS["DRONE-01"][0], "lng": ANCHORS["DRONE-01"][1], "aqi": 130, "status": "ACTIVE"},
    "DRONE-02": {"lat": ANCHORS["DRONE-02"][0], "lng": ANCHORS["DRONE-02"][1], "aqi": 65, "status": "ACTIVE"},
    "DRONE-03": {"lat": ANCHORS["DRONE-03"][0], "lng": ANCHORS["DRONE-03"][1], "aqi": 65, "status": "ACTIVE"}
}

def drift_drones():
    for drone_id, anchor in ANCHORS.items():
        lat_drift = random.uniform(-0.0001, 0.0001)
        lng_drift = random.uniform(-0.0001, 0.0001)
        new_lat = drones_state[drone_id]["lat"] + lat_drift
        new_lng = drones_state[drone_id]["lng"] + lng_drift
        drones_state[drone_id]["lat"] = max(anchor[0] - 0.0010, min(anchor[0] + 0.0010, new_lat))
        drones_state[drone_id]["lng"] = max(anchor[1] - 0.0010, min(anchor[1] + 0.0010, new_lng))
        aqi_drift = random.randint(-3, 3)
        new_aqi = drones_state[drone_id]["aqi"] + aqi_drift
        if drone_id == "DRONE-01":
            drones_state[drone_id]["aqi"] = max(110, min(150, new_aqi))
        else:
            drones_state[drone_id]["aqi"] = max(40, min(90, new_aqi))

def generate_heatmap_data():
    lats = [d['lat'] for d in drones_state.values()]
    lngs = [d['lng'] for d in drones_state.values()]
    min_lat, max_lat = min(lats) - 0.003, max(lats) + 0.003
    min_lng, max_lng = min(lngs) - 0.003, max(lngs) + 0.003
    grid_lat, grid_lng = np.mgrid[min_lat:max_lat:30j, min_lng:max_lng:30j]
    grid_points = np.vstack((grid_lat.ravel(), grid_lng.ravel())).T
    drone_points = np.array([[d['lat'], d['lng']] for d in drones_state.values()])
    drone_aqis = np.array([d['aqi'] for d in drones_state.values()])
    distances = cdist(grid_points, drone_points)
    sigma = 0.001 
    weights = np.exp(-(distances**2) / (2 * sigma**2))
    heat_values = np.dot(weights, drone_aqis)
    normalized_heat = np.clip(heat_values / 150.0, 0.0, 1.0)
    heatmap_payload = []
    for i in range(len(grid_points)):
        if normalized_heat[i] > 0.05:
            heatmap_payload.append([grid_points[i][0], grid_points[i][1], round(float(normalized_heat[i]), 3)])
    return heatmap_payload

async def stream_telemetry():
    uri = "ws://localhost:8000/ws/telemetry"
    while True:
        try:
            async with websockets.connect(uri) as websocket:
                print(f"Connected to {uri}. Streaming Drones + Heatmap with updated anchors...")
                while True:
                    drift_drones()
                    heatmap_data = generate_heatmap_data()
                    
                    payload = {
                        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                        "drones": drones_state,
                        "heatmap": heatmap_data 
                    }
                    
                    await websocket.send(json.dumps(payload))
                    await asyncio.sleep(1.0) 
        
        except ConnectionRefusedError:
            print("Server not ready. Retrying...")
            await asyncio.sleep(2)
        except websockets.exceptions.ConnectionClosed:
            print("Connection lost. Reconnecting...")
            await asyncio.sleep(2)

if __name__ == "__main__":
    asyncio.run(stream_telemetry())