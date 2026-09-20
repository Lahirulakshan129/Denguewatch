import os
import psycopg2

DB = {
    "host": os.environ.get("DB_HOST", "127.0.0.1"),
    "port": int(os.environ.get("DB_PORT", "5432")),
    "user": os.environ.get("DB_USER", "postgres"),
    "password": os.environ.get("DB_PASSWORD", "postgres"),
    "dbname": os.environ.get("DB_NAME", "denguewatch"),
}

conn = psycopg2.connect(**DB)
cur = conn.cursor()

print("=== dataset_record 2026 weeks 20-40 ===")
cur.execute(
    """
    SELECT week, COUNT(*) n, COUNT(avg_temp) weather, COUNT(dengue_cases) dengue
    FROM dataset_record
    WHERE year = 2026 AND week BETWEEN 20 AND 40
    GROUP BY week
    ORDER BY week
    """
)
for r in cur.fetchall():
    print(" ", r)

print("\n=== prediction_record ===")
cur.execute("SELECT COUNT(*) FROM prediction_record")
print(" rows", cur.fetchone()[0])
cur.execute(
    """
    SELECT predicted_year, predicted_week, COUNT(*), MIN(predicted_cases), MAX(predicted_cases)
    FROM prediction_record
    GROUP BY predicted_year, predicted_week
    ORDER BY predicted_year, predicted_week
    """
)
for r in cur.fetchall():
    print(" ", r)

print("\n=== Colombo dengue 2026_20-38 ===")
cur.execute(
    """
    SELECT week, dengue_cases, avg_temp, total_rainfall
    FROM dataset_record
    WHERE district = 'Colombo' AND year = 2026 AND week BETWEEN 20 AND 38
    ORDER BY week
    """
)
for r in cur.fetchall():
    print(" ", r)

cur.close()
conn.close()
