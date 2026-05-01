import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from server.routes import reports, approvals, monitoring, regulator, genie, supervisor
from server.config import get_dashboard_id, get_genie_space_id, get_workspace_host

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

FRONTEND_DIR = Path(__file__).parent / "frontend" / "dist"


async def _warmup_warehouse():
    """Fire a tiny query to wake the SQL warehouse so first user request isn't slow."""
    try:
        from server.sql import execute_query
        await execute_query("SELECT 1 AS warmup")
        logger.info("Warehouse warmup completed")
    except Exception:
        logger.exception("Warehouse warmup failed — will retry on first request")


@asynccontextmanager
async def lifespan(application: FastAPI):
    logger.info("Starting Solvency II QRT Reporting App")
    try:
        await approvals.ensure_approvals_table()
        logger.info("Approvals table ready")
    except Exception:
        logger.exception("Failed to ensure approvals table — will retry on first request")
    # Fire-and-forget warmup so we don't block app startup
    import asyncio
    asyncio.create_task(_warmup_warehouse())
    yield
    logger.info("Shutting down")


app = FastAPI(
    title="Solvency II QRT Reporting & Approval",
    version="2.0.0",
    lifespan=lifespan,
)

app.include_router(reports.router)
app.include_router(approvals.router)
app.include_router(monitoring.router)
app.include_router(regulator.router)
app.include_router(genie.router)
app.include_router(supervisor.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/embeds")
async def embeds():
    host = get_workspace_host()
    dashboard_id = get_dashboard_id()
    genie_space_id = get_genie_space_id()
    return {
        "dashboard_url": f"{host}/embed/dashboardsv3/{dashboard_id}",
        "genie_url": f"{host}/embed/genie/spaces/{genie_space_id}",
        "dashboard_id": dashboard_id,
        "genie_space_id": genie_space_id,
    }


@app.get("/api/backstage-url")
async def backstage_url():
    host = get_workspace_host()
    try:
        from server.config import get_current_user
        user = get_current_user()
        nb_path = f"/Workspace/Users/{user}/solvency-ii-qrt-demo-agentic/06_backstage_technical"
        return {"url": f"{host}#notebook{nb_path}"}
    except Exception:
        return {"url": f"{host}#workspace"}


if FRONTEND_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = FRONTEND_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_DIR / "index.html")
