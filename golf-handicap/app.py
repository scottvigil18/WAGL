"""Golf Handicap Calculator - Flask microservice for USGA handicap index computation."""

from flask import Flask, request, jsonify

app = Flask(__name__)

# Attempt to load course data from kagglehub for reference/calibration.
# The actual course_rating and slope_rating come from the request body.
DEFAULT_COURSE_RATING = 72.0
DEFAULT_SLOPE_RATING = 113

try:
    import kagglehub
    _dataset_path = kagglehub.dataset_download("fletcherkennamer/grandpa-golf")
    print(f"Kagglehub dataset loaded at: {_dataset_path}")
except Exception as e:
    print(f"Kagglehub dataset not available, using defaults: {e}")


# USGA lookup table: (min_scores, max_scores) -> (differentials_used, adjustment)
USGA_TABLE = [
    (3, 3, 1, -2.0),
    (4, 4, 1, -1.0),
    (5, 5, 1, 0.0),
    (6, 6, 2, -1.0),
    (7, 8, 2, 0.0),
    (9, 11, 3, 0.0),
    (12, 14, 4, 0.0),
    (15, 16, 5, 0.0),
    (17, 18, 6, 0.0),
    (19, 19, 7, 0.0),
    (20, float('inf'), 8, 0.0),
]


def get_usga_params(num_scores):
    """Look up the number of differentials to use and adjustment from the USGA table."""
    for min_s, max_s, diff_used, adjustment in USGA_TABLE:
        if min_s <= num_scores <= max_s:
            return diff_used, adjustment
    return 1, 0.0


def calculate_handicap_index(scores, course_rating, slope_rating):
    """
    Calculate the USGA handicap index.

    Returns a tuple of (handicap_index, differentials_used, message).
    """
    num_scores = len(scores)

    if num_scores < 3:
        return None, 0, "Insufficient scores (minimum 3 required)"

    # Compute all differentials
    differentials = [(score - course_rating) * 113 / slope_rating for score in scores]

    # Determine how many best differentials to use and the adjustment
    diff_used, adjustment = get_usga_params(num_scores)

    # Sort differentials ascending and take the best (lowest) N
    sorted_differentials = sorted(differentials)
    best_differentials = sorted_differentials[:diff_used]

    # Handicap Index = average of best differentials + adjustment
    avg = sum(best_differentials) / len(best_differentials)
    handicap_index = round(avg + adjustment, 1)

    return handicap_index, diff_used, None


@app.route('/api/handicap/calculate', methods=['POST'])
def calculate():
    """Calculate handicap index from provided scores."""
    data = request.get_json(silent=True)

    if data is None:
        return jsonify({"error": "Request body must be valid JSON"}), 400

    # Validate scores
    scores = data.get('scores')
    if scores is None:
        return jsonify({"error": "Missing required field: scores"}), 400
    if not isinstance(scores, list):
        return jsonify({"error": "scores must be an array of numbers"}), 400
    if not all(isinstance(s, (int, float)) and not isinstance(s, bool) for s in scores):
        return jsonify({"error": "scores must be an array of numbers"}), 400

    # Validate course_rating
    course_rating = data.get('course_rating')
    if course_rating is None:
        return jsonify({"error": "Missing required field: course_rating"}), 400
    if not isinstance(course_rating, (int, float)) or isinstance(course_rating, bool):
        return jsonify({"error": "course_rating must be a positive number"}), 400
    if course_rating <= 0:
        return jsonify({"error": "course_rating must be a positive number"}), 400

    # Validate slope_rating
    slope_rating = data.get('slope_rating')
    if slope_rating is None:
        return jsonify({"error": "Missing required field: slope_rating"}), 400
    if not isinstance(slope_rating, (int, float)) or isinstance(slope_rating, bool):
        return jsonify({"error": "slope_rating must be a positive number"}), 400
    if slope_rating <= 0:
        return jsonify({"error": "slope_rating must be a positive number"}), 400

    handicap_index, differentials_used, message = calculate_handicap_index(
        scores, course_rating, slope_rating
    )

    return jsonify({
        "handicap_index": handicap_index,
        "differentials_used": differentials_used,
        "message": message
    })


@app.route('/api/handicap/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok"})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)
