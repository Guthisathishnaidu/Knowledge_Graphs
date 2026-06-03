# Use official Python runtime as a parent image
FROM python:3.10-slim

# Set the working directory in the container
WORKDIR /app

# Install system dependencies (needed for compiling some python packages)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy the requirements file into the container
COPY requirements.txt .

# Install python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the project code into the container
# This is important because backend/api.py imports from milestone3/ in the root directory!
COPY . .

# Expose the port
EXPOSE 8000

# Start Uvicorn from the backend folder, mapping it to the PORT provided by Render
CMD ["sh", "-c", "cd backend && uvicorn api:app --host 0.0.0.0 --port ${PORT:-8000}"]
