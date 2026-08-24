from typing import Literal, Optional

from pydantic import BaseModel

StepStatus = Literal["pending", "running", "done", "error"]
JobStatus = Literal["running", "completed", "completed_with_errors", "failed"]


class PanelRefreshRequest(BaseModel):
    periodo: str


class PanelRefreshAccepted(BaseModel):
    job_id: str


class RefreshStepOut(BaseModel):
    mandante: str
    cartera: str
    label: str
    status: StepStatus
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    duration_seconds: Optional[float] = None
    error: Optional[str] = None


class RefreshJobOut(BaseModel):
    job_id: str
    periodo: str
    status: JobStatus
    started_at: str
    finished_at: Optional[str] = None
    steps: list[RefreshStepOut]
