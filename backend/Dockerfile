FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN chmod +x /app/entrypoint.sh
# I file statici (admin, ecc.) si raccolgono UNA volta in fase di build e
# whitenoise li serve a runtime: niente collectstatic a ogni avvio. Non
# tocca il DB; con DEBUG di default la SECRET_KEY di sviluppo basta.
RUN python manage.py collectstatic --no-input
EXPOSE 8000
# Avvio autonomo per Cloud Run. In locale docker-compose sovrascrive con il
# proprio `command:`, quindi questo CMD non interferisce con lo sviluppo.
CMD ["sh", "/app/entrypoint.sh"]
