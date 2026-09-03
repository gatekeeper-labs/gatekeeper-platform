import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const db = new Pool({
    port: parseInt(process.env.DB_PORT || '5432'),
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.on("connect", () => {
    console.log("✅ Banco de dados conectado com sucesso!");
});

db.on("error", (err) => {
    console.log("❌ Erro ao conectar ao banco de dados!", err);
});

export default db;