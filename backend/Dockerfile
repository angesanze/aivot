FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN chmod +x /app/entrypoint.sh
EXPOSE 8000
# Avvio autonomo per Cloud Run. In locale docker-compose sovrascrive con il
# proprio `command:`, quindi questo CMD non interferisce con lo sviluppo.
CMD ["sh", "/app/entrypoint.sh"]
