FROM python:3.14-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app

ENV FLASK_ENV=production
ENV FLASK_DEBUG=0
ENV SESSION_COOKIE_SECURE=1

EXPOSE 5000

CMD ["gunicorn", "-k", "eventlet", "-w", "1", "server:app", "-b", "0.0.0.0:5000"]
