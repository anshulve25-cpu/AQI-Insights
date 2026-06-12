"""
AQI Drone Telemetry Server
FastAPI + SQLAlchemy (async) + WebSocket broadcast
"""

import asyncio
from datetime import datetime
from typing import Dict, List, Optional

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import desc, select

from database import AsyncSessionLocal, DroneTelemetry, init_db

# ─────────────────────────────────────────────────────────────────────────────
# App setup
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(title="AQI Telemetry API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)


# ─────────────────────────────────────────────────────────────────────────────
# Startup
# ─────────────────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def on_startup() -> None:
    await init_db()
    print("✓ Database initialised")


# ─────────────────────────────────────────────────────────────────────────────
# In-memory state  (latest snapshot for quick reads)
# ─────────────────────────────────────────────────────────────────────────────

latest_drone_state: Dict[str, dict] = {}


# ─────────────────────────────────────────────────────────────────────────────
# WebSocket connection manager
# ─────────────────────────────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self) -> None:
        self._connections: List[WebSocket] = []

    @property
    def count(self) -> int:
        return len(self._connections)

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.append(ws)
        print(f"  WS connected  — total: {self.count}")

    def disconnect(self, ws: WebSocket) -> None:
        self._connections.discard(ws) if hasattr(self._connections, "discard") \
            else self._connections.remove(ws) if ws in self._connections else None
        print(f"  WS disconnected — total: {self.count}")

    async def broadcast(self, payload: dict) -> None:
        dead: List[WebSocket] = []
        for ws in list(self._connections):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()


# ─────────────────────────────────────────────────────────────────────────────
# Background DB writer  (fire-and-forget, never blocks the WS loop)
# ─────────────────────────────────────────────────────────────────────────────

async def _persist_telemetry(payload: dict) -> None:
    try:
        ts_raw = payload.get("timestamp", "").replace("Z", "+00:00")
        ts = datetime.fromisoformat(ts_raw) if ts_raw else datetime.utcnow()

        records = [
            DroneTelemetry(
                timestamp=ts,
                drone_id=drone_id,
                lat=data.get("lat"),
                lng=data.get("lng"),
                aqi=data.get("aqi"),
                status=data.get("status"),
            )
            for drone_id, data in payload.get("drones", {}).items()
        ]

        if records:
            async with AsyncSessionLocal() as session:
                session.add_all(records)
                await session.commit()

    except Exception as exc:
        print(f"  DB write error: {exc}")


# ─────────────────────────────────────────────────────────────────────────────
# REST endpoints
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/telemetry/history", summary="Last 30 seconds of AQI readings per drone")
async def get_history() -> dict:
    async with AsyncSessionLocal() as session:
        stmt = (
            select(DroneTelemetry)
            .order_by(desc(DroneTelemetry.timestamp))
            .limit(200)
        )
        rows = (await session.execute(stmt)).scalars().all()

    # Pivot rows into { time: { DRONE-XX: aqi } } keeping chronological order
    buckets: Dict[str, dict] = {}
    for row in reversed(rows):
        key = row.timestamp.strftime("%H:%M:%S")
        buckets.setdefault(key, {"time": key})[row.drone_id] = row.aqi

    history = list(buckets.values())[-30:]
    return {"history": history}


@app.get("/api/drones/latest", summary="Current snapshot of all drone states")
async def get_latest() -> dict:
    return {"drones": latest_drone_state}


# ─────────────────────────────────────────────────────────────────────────────
# WebSocket endpoint
# ─────────────────────────────────────────────────────────────────────────────

@app.websocket("/ws/telemetry")
async def ws_telemetry(ws: WebSocket) -> None:
    await manager.connect(ws)
    try:
        while True:
            payload: dict = await ws.receive_json()

            # Update in-memory snapshot
            if "drones" in payload:
                latest_drone_state.update(payload["drones"])

            # Persist async (never awaited inline)
            asyncio.create_task(_persist_telemetry(payload))

            # Fan-out to all connected clients
            await manager.broadcast(payload)

    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception as exc:
        print(f"  WS error: {exc}")
        manager.disconnect(ws)


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)