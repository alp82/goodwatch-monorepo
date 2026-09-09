from f.db.postgres import init_postgres


def init_postgres_tables(pg):
    pg_cursor = pg.cursor()
    with open("./create_streaming_provider_ranking_table.pg.sql", "r") as f:
        create_table_query = f.read()

    pg_cursor.execute(create_table_query)
    pg.commit()


def main():
    pg = init_postgres()
    pg_cursor = pg.cursor()

    # TODO fix file not found
    #init_postgres_tables(pg=pg)

    table_name = "streaming_provider_ranking"
    pg_cursor.execute("BEGIN")
    pg_cursor.execute(f"TRUNCATE TABLE {table_name}")

    query = """
    SELECT
      sp.id, sp.name, sp.logo_path, COUNT(spl.provider_id) as provider_count
    FROM
      streaming_providers sp
    LEFT JOIN
      streaming_provider_links spl ON sp.id = spl.provider_id
    --WHERE
    --  spl.media_type = '${mediaType}'
    GROUP BY
      sp.id, sp.name, sp.logo_path
    ORDER BY
      provider_count DESC;
    """
    pg_cursor.execute(query)
    rows = pg_cursor.fetchall()
    
    insert_query = f"""
    INSERT INTO {table_name} (id, name, logo_path, link_count)
    VALUES (%s, %s, %s, %s)
    """
    pg_cursor.executemany(insert_query, [(row[0], row[1], row[2], row[3]) for row in rows])

    pg.commit()
    pg_cursor.close()
    pg.close()

    top10 = [{
        "provider_id": row[0],
        "provider_name": row[1],
        "logo_path": row[2],
        "link_count": row[3]
    } for row in rows[:10]]
    return {"count": len(rows), "top10": top10}


if __name__ == "__main__":
    main()
