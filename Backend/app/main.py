from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import CORS_ORIGINS
from app.routers import auth, panel_araucana, panel_cenco, panel_cla

app = FastAPI(title="KPI Mandantes API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(panel_cla.router)
app.include_router(panel_cenco.router)
app.include_router(panel_araucana.router)


@app.get("/health")
def health():
    return {"status": "ok"}
