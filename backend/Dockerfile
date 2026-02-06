# postgres:17.6-alpine3.22
# python:3.12.12-slim
# nginx:1.29-alpine3.22

FROM python:3.12.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "src.app:app", "--host", "0.0.0.0", "--port", "8000"]
# CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "src.app:app", "-w", "4", "-b", "0.0.0.0:8000"]
#CMD ["sh", "-c", "uvicorn src.app:app --host 0.0.0.0 --port 8000"]
