"""FastAPI for the "Своя пожежа" page (Cloud Run). Owner: Misha. Bonus: the demo does not depend on it.

    uvicorn api.main:app --reload
"""

from fastapi import FastAPI

app = FastAPI(title="Forest Recovery API")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
