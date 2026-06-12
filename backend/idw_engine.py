import numpy as np
from scipy.spatial.distance import cdist

LAT_MIN, LAT_MAX = 29.8600, 29.8750
LNG_MIN, LNG_MAX = 77.8850, 77.9050

GRID_RESOLUTION = 50  

_lats = np.linspace(LAT_MIN, LAT_MAX, GRID_RESOLUTION)
_lngs = np.linspace(LNG_MIN, LNG_MAX, GRID_RESOLUTION)
_grid_lng, _grid_lat = np.meshgrid(_lngs, _lats)
_grid_points = np.column_stack((_grid_lat.ravel(), _grid_lng.ravel()))

def generate_heatmap_data(drones_state: dict, power: float = 2.0, max_aqi: float = 300.0) -> list:
    if not drones_state:
        return []

    drone_coords = []
    drone_aqis = []
    
    for drone_id, data in drones_state.items():
        if data.get("status") == "ACTIVE":
            drone_coords.append([data["lat"], data["lng"]])
            drone_aqis.append(data["aqi"])

    if not drone_coords:
        return []
    drone_coords = np.array(drone_coords)
    drone_aqis = np.array(drone_aqis)
    distances = cdist(_grid_points, drone_coords)
    distances = np.where(distances == 0, 1e-10, distances)
    weights = 1.0 / (distances ** power)
    weighted_aqi = np.sum(weights * drone_aqis, axis=1) / np.sum(weights, axis=1)
    intensities = np.clip(weighted_aqi / max_aqi, 0.0, 1.0)
    heatmap_data = np.column_stack((_grid_points, intensities)).tolist()

    return heatmap_data