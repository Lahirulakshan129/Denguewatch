import os
import psycopg2

conn = psycopg2.connect(
    host="127.0.0.1", port=5432, user="postgres", password="postgres", dbname="denguewatch"
)
cur = conn.cursor()
cur.execute(
    """
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'prediction_record'
    ORDER BY ordinal_position
    """
)
print("prediction_record columns:")
for r in cur.fetchall():
    print(" ", r)
cur.close()
conn.close()
