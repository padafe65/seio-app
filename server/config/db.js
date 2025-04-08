// backend-rifa/config/db.js
import mysql from 'mysql2/promise';
import mysql from "mysql2/promise"; 

const pool = mysql.createPool({
    host: "localhost",
    user: "root",         // Cambia si tienes otro usuario
    password: "",         // Si tienes contraseña, agrégala aquí
    database: "rifa",     // Cambia por el nombre de tu BD
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

export default pool;

