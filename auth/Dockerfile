FROM python:3.10

WORKDIR /app
COPY . .

RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 4000
CMD ["python", "app.py"]
