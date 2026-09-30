import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { config } from "../config/index.js";
import * as schema from "./schema.js";

export const pool = mysql.createPool({
  uri: config.databaseUrl,
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
});

export const db = drizzle(pool, { schema, mode: "default" });

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const connection = await pool.getConnection();
    await connection.query("SELECT 1");
    connection.release();
    return true;
  } catch (err) {
    return false;
  }
}
