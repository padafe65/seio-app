import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';
import { dirname } from 'path';
import dotenv from 'dotenv';
import multer from 'multer';

// Importar rutas
import authRoutes from './routes/auth.js';
import studentRoutes from './routes/studentRoutes.js';
import teacherRoutes from './routes/teacherRoutes.js';
import courseRoutes from './routes/courses.js';
import subjectRoutes from './routes/subjects.js';
import questionnaireRoutes from './routes/questionnaireRoutes.js';
import questionRoutes from './routes/questionRoutes.js';
import quizRoutes from './routes/quiz.js';
import indicatorRoutes from './routes/indicatorRoutes.js';
import evaluationResultsRoutes from './routes/evaluationResults.js';
import improvementPlansRoutes from './routes/improvementPlans.js';
import phaseEvaluationRoutes from './routes/phaseEvaluation.js';
import teacherCoursesRoutes from './routes/teacherCoursesRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import pool from './config/db.js';

// Configuración de rutas de archivos
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../.env') });

// Verificar variables de entorno
console.log("Verificando variables de entorno:");
console.log("DB_HOST:", process.env.DB_HOST);
console.log("DB_USER:", process.env.DB_USER);
console.log("DB_PASSWORD:", process.env.DB_PASSWORD ? '(cargada)' : '(no cargada)');
console.log("DB_NAME:", process.env.DB_NAME);
console.log("JWT_SECRET:", process.env.JWT_SECRET ? '(cargado)' : '(no cargado)');

// Configuración de Express
const app = express();

// Configuración de CORS
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Content-Length', 'X-Requested-With']
};

app.use(cors(corsOptions));
app.use(express.json());

// Manejar solicitudes preflight
app.options('*', cors(corsOptions));

// Configuración de Multer para carga de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `comprobante_${Date.now()}${ext}`;
    cb(null, name);
  }
});

const upload = multer({ storage });

// Ruta para subir comprobantes
app.post('/api/subir-comprobante/:id', upload.single('imagen'), async (req, res) => {
  try {
    const rifaId = req.params.id;
    const imagenNombre = req.file.filename;

    const [result] = await pool.query(
      'UPDATE numeros_jugados SET estado = "Cancelado", imagen_pago = ? WHERE id = ?',
      [imagenNombre, rifaId]
    );

    res.json({ mensaje: '✔️ Comprobante subido y estado actualizado', imagen: imagenNombre });
  } catch (err) {
    console.error('❌ Error actualizando comprobante:', err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Middleware para registrar todas las rutas
const logRoutes = (router, prefix = '') => {
  router.stack.forEach(middleware => {
    if (middleware.route) {
      // Rutas registradas directamente en el router
      const methods = Object.keys(middleware.route.methods).map(method => method.toUpperCase()).join(', ');
      console.log(`[ROUTE] ${methods} ${prefix}${middleware.route.path}`);
    } else if (middleware.name === 'router')
       {
      // Rutas anidadas (subrouters)
      middleware.handle.stack.forEach(handler => {
        const route = handler.route;
        if (route) {
          const methods = Object.keys(route.methods).map(method => method.toUpperCase()).join(', ');
          console.log(`[ROUTE] ${methods} ${prefix}${route.path}`);
        }
      });
    }
  });
};

// Configuración de rutas API
const apiRoutes = [
  { path: '/api/auth', router: authRoutes },
  { path: '/api/students', router: studentRoutes },
  { path: '/api/teachers', router: teacherRoutes },
  { path: '/api/courses', router: courseRoutes },
  { path: '/api/subjects', router: subjectRoutes },
  { path: '/api/questionnaires', router: questionnaireRoutes },
  { path: '/api/questions', router: questionRoutes },
  { path: '/api/quiz', router: quizRoutes },
  { path: '/api/indicators', router: indicatorRoutes },
  { path: '/api/evaluation-results', router: evaluationResultsRoutes },
  { path: '/api/improvement-plans', router: improvementPlansRoutes },
  { path: '/api/phase-evaluations', router: phaseEvaluationRoutes },
  { path: '/api/teacher-courses', router: teacherCoursesRoutes },
  { path: '/api/admin', router: adminRoutes }
];

// Registrar todas las rutas
console.log('\n🔍 Iniciando registro de rutas...');

// Función auxiliar para registrar una ruta con manejo de errores detallado
const registerRoute = (path, router) => {
  try {
    console.log(`\n🔍 Intentando registrar ruta: '${path}'`);
    
    // Verificar que la ruta no sea una URL completa
    if (path.match(/^https?:\/\//)) {
      throw new Error(`La ruta parece ser una URL completa: ${path}. Las rutas deben ser rutas relativas que comiencen con /`);
    }
    
    // Verificar que la ruta comience con /
    if (!path.startsWith('/')) {
      throw new Error(`La ruta '${path}' no comienza con /`);
    }
    
    // Registrar la ruta
    app.use(path, router);
    
    // Registrar todas las rutas definidas en el router
    if (router && typeof router.stack === 'function') {
      console.log(`  ✅ RUTA: '${path}' registrada correctamente`);
    } else if (router && Array.isArray(router.stack)) {
      router.stack.forEach(layer => {
        if (layer && layer.route) {
          const methods = Object.keys(layer.route.methods).map(method => method.toUpperCase()).join(', ');
          console.log(`  ✅ RUTA: ${methods} '${path}${layer.route.path}'`);
        }
      });
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Error al registrar la ruta '${path}':`);
    console.error('Tipo de error:', error.name);
    console.error('Mensaje:', error.message);
    
    if (error.stack) {
      console.error('Stack trace:');
      console.error(error.stack.split('\n').slice(0, 5).join('\n'));
    }
    
    throw error; // Relanzar el error para detener la ejecución
  }
};

try {
  // Registrar cada ruta individualmente para un mejor manejo de errores
  for (const { path, router } of apiRoutes) {
    registerRoute(path, router);
  }
  
  console.log('\n✅ Todas las rutas se han registrado correctamente');
  
} catch (error) {
  console.error('\n❌ ERROR CRÍTICO DURANTE EL REGISTRO DE RUTAS:');
  console.error('----------------------------------------');
  console.error('Tipo de error:', error.name);
  console.error('Mensaje:', error.message);
  
  if (error.stack) {
    console.error('\nStack trace:');
    console.error(error.stack);
  }
  
  console.error('\n🔍 STACK TRACE:');
  console.error(error.stack || 'No hay stack trace disponible');
  
  // Intentar obtener más contexto del error
  if (error.message.includes('pathToRegexp') && error.stack) {
    const match = error.stack.match(/at .*? \(.*?:(\d+):(\d+)\)/);
    if (match) {
      const line = match[1];
      const column = match[2];
      console.error(`\n📌 Posición del error: Línea ${line}, Columna ${column}`);
    }
  }
  
  console.error('\n💡 SUGERENCIA: Verifica los archivos de rutas para asegurarte de que todas las rutas estén correctamente definidas.');
  
  // Detener la ejecución para evitar problemas posteriores
  process.exit(1);
}

// Servir archivos estáticos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({ message: 'API de SEIO funcionando correctamente' });
});

// Manejador de errores global
app.use((err, req, res, next) => {
  // Si el error es de path-to-regexp, mostrar más detalles
  if (err.message.includes('pathToRegexp') || err.message.includes('Missing parameter name')) {
    console.error('❌ ERROR DE RUTA MAL FORMADA:', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      url: req.originalUrl,
      body: req.body,
      query: req.query,
      params: req.params,
      rawError: err.toString()
    });
    
    // Intentar extraer información adicional del error
    const errorMatch = err.message.match(/at (\d+):\s*(.*)/);
    if (errorMatch) {
      console.error('🔍 Posición del error:', errorMatch[1]);
      console.error('🔍 Ruta problemática:', errorMatch[2]);
    }
  } else {
    console.error('❌ Error no manejado:', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      url: req.originalUrl,
      body: req.body,
      query: req.query,
      params: req.params
    });
  }
  
  res.status(500).json({ 
    success: false, 
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      isPathToRegexpError: err.message.includes('pathToRegexp') || err.message.includes('Missing parameter name'),
      originalUrl: req.originalUrl
    } : {}
  });
});

// Puerto del servidor
const PORT = process.env.PORT || 5000;

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en el puerto ${PORT}`);
  console.log(`🔗 URL: http://localhost:${PORT}`);
});

export default app;
