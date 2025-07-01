import dotenv from 'dotenv';

dotenv.config();

const config = {
  // Configuración de la base de datos
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'seio',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  },
  
  // Configuración de autenticación
  jwt: {
    secret: process.env.JWT_SECRET || 'secreto_por_defecto_cambiar_en_produccion',
    expiresIn: '8h'
  },
  
  // Configuración del servidor
  server: {
    port: process.env.PORT || 5000,
    nodeEnv: process.env.NODE_ENV || 'development',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
  },
  
  // Configuración de roles
  roles: {
    superAdmin: 'super_administrador',
    admin: 'administrador',
    teacher: 'docente',
    student: 'estudiante'
  }
};

export default config;
