import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt'; // Para encriptar contraseñas
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { fileURLToPath } from 'url';
import path from 'path';
import { dirname } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


const app = express();
app.use(cors());
app.use(express.json()); 
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Conexión a MySQL
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

// Configurar multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/'); // crea esta carpeta si no existe
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const nombre = `comprobante_${Date.now()}${ext}`;
      cb(null, nombre);
    }
  });

const upload = multer({ storage });


// 🚨 ESTA ES LA RUTA QUE DEBES TENER
app.post('/api/subir-comprobante/:id', upload.single('imagen'), (req, res) => {
  const rifaId = req.params.id;
  const imagenNombre = req.file.filename;



  const sql = 'UPDATE numeros_jugados SET estado = "Cancelado", imagen_pago = ? WHERE id = ?';
  db.query(sql, [imagenNombre, rifaId], (err, result) => {
    if (err) {
      console.error('❌ Error actualizando comprobante:', err);
      return res.status(500).json({ error: 'Error en el servidor' });
    }
    res.json({ mensaje: '✔️ Comprobante subido y estado actualizado', imagen: imagenNombre });
  });
});

// Servir la carpeta "uploads" como pública
app.use('/uploads', express.static('uploads'));


app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const [rows] = await db.query("SELECT * FROM usuarios WHERE email = ?", [email]);

        if (rows.length === 0) {
            return res.status(401).json({ error: "Usuario no encontrado" });
        }

        const user = rows[0];
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return res.status(401).json({ error: "Contraseña incorrecta" });
        }

        const token = jwt.sign({ id: user.id, rol: user.rol }, process.env.JWT_SECRET, { expiresIn: '2h' });

        res.json({
            message: "Inicio de sesión exitoso",
            token,
            usuario: {
                id: user.id,
                nombre: user.nombre,
                telefono: user.telefono,
                email: user.email,
                rol: user.rol
            }
        });
    } catch (error) {
        res.status(500).json({ error: "Error en el servidor" });
    }
});


// 🔹 Nueva ruta para registrar usuarios
app.post('/api/auth/register', async (req, res) => {
    console.log("📥 Datos recibidos:", req.body);
    try {
        const { nombre, telefono, email,  password, rol } = req.body;

        // Verificar si el usuario ya existe
        const [userExists] = await db.query("SELECT * FROM usuarios WHERE email = ?", [nombre]);
        if (userExists.length > 0) {
            return res.status(400).json({ error: "El usuario ya existe" });
        }

        // Encriptar contraseña
        const hashedPassword = await bcrypt.hash(password, 10);
        // Guardar en la base de datos
        await db.query("INSERT INTO usuarios (nombre, telefono, email, password, rol) VALUES (?, ?, ?, ?, ?)", 
            [nombre, telefono, email, hashedPassword, rol]);

        console.log("✅ Usuario registrado");
        res.status(201).json({ message: "Usuario registrado con éxito" });
    } catch (error) {
        console.error("❌ Error en el servidor:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
});

const verificarToken = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1]; // Extrae el token del header

    if (!token) {
        return res.status(401).json({ error: "Acceso denegado: No autenticado" });
    }

    jwt.verify(token, 'tu_secreto', (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: "Token inválido" });
        }
        req.usuario_id = decoded.id; // Guarda el ID del usuario en la petición
        next();
    });
};

app.post('/api/rifa/guardar', async (req, res) => {
    try {
        const { usuario_id, numeros, totalPago } = req.body;

        if (!usuario_id || !numeros || numeros.length === 0) {
            return res.status(400).json({ error: "Datos incompletos" });
        }
        //alert(usuario_id);
        const numerosJSON = JSON.stringify(numeros);

        await db.query(
            "INSERT INTO numeros_jugados (usuario_id, numeros, monto_total, estado) VALUES (?, ?, ?, 'Debe')",
            [usuario_id, numerosJSON, totalPago]);

        res.json({ message: "Números guardados con éxito" });
    } catch (error) {
        console.error("Error al guardar números:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
});


app.put('/api/rifa/pagar/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await db.query(
            "UPDATE numeros_jugados SET estado = 'Cancelado' WHERE id = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Registro no encontrado" });
        }

        res.json({ message: "Pago actualizado con éxito" });
    } catch (error) {
        console.error("Error al actualizar pago:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
});


app.get('/api/rifa/listar/:usuario_id', async (req, res) => {
    try {
        const { usuario_id } = req.params;

        const [rows] = await db.query(
            "SELECT * FROM numeros_jugados WHERE usuario_id = ?",
            [usuario_id]
        );

        res.json(rows);
    } catch (error) {
        console.error("Error al obtener rifas:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
});

app.get('/api/rifas', async (req, res) => {
    try {
      const [rows] = await db.query(`
        SELECT r.*, u.nombre AS nombre_usuario 
        FROM numeros_jugados r
        JOIN usuarios u ON r.usuario_id = u.id
      `);
      res.json(rows);
    } catch (error) {
      console.error("Error al obtener rifas:", error);
      res.status(500).json({ error: "Error en el servidor" });
    }
  });

app.get('/api/rifa/listar/:usuario_id', async (req, res) => {
    try {
        const { usuario_id } = req.params;

        const [rows] = await db.query(
            "SELECT * FROM numeros_jugados WHERE usuario_id = ?",
            [usuario_id]
        );

        res.json(rows);
    } catch (error) {
        console.error("Error al obtener rifas:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
});
// Servidor corriendo en el puerto 5000
app.listen(5000, () => {
    console.log("🚀 Servidor corriendo en http://localhost:5000");
});
