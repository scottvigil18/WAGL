# Golf Handicap Calculator Service

A Python Flask microservice that calculates USGA handicap indexes from golf scores.

## Setup

### Create and activate a virtual environment

```bash
cd golf-handicap

# Create venv
python3 -m venv venv

# Activate (macOS/Linux)
source venv/bin/activate

# Activate (Windows)
venv\Scripts\activate
```

### Install dependencies

```bash
pip install -r requirements.txt
```

## Running the Service

```bash
python app.py
```

The service runs on **http://localhost:5001**.

### Endpoints

- `POST /api/handicap/calculate` — Calculate handicap index from scores
- `GET /api/handicap/health` — Health check

### Example Request

```bash
curl -X POST http://localhost:5001/api/handicap/calculate \
  -H "Content-Type: application/json" \
  -d '{"scores": [85, 90, 88, 92, 87], "course_rating": 72.1, "slope_rating": 131}'
```

### Example Response

```json
{
  "handicap_index": 14.3,
  "differentials_used": 1,
  "message": null
}
```

## Running Tests

```bash
pytest
```
