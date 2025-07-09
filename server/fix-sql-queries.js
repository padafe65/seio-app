import fs from 'fs';
import path from 'path';

// Ruta al archivo studentRoutes.js
const studentRoutesPath = path.join(process.cwd(), 'routes', 'studentRoutes.js');

// Leer el contenido del archivo
let content = fs.readFileSync(studentRoutesPath, 'utf8');

// Reemplazar las consultas SQL problemáticas
content = content.replace(
  /SELECT s\.id, u\.name, u\.lastname, u\.email, u\.phone, c\.name as course_name/g,
  'SELECT s.id, u.name, u.email, u.phone, c.name as course_name'
);

content = content.replace(
  /SELECT s\.\*, u\.name, u\.lastname, u\.email, u\.phone, c\.name as course_name/g,
  'SELECT s.*, u.name, u.email, u.phone, c.name as course_name'
);

// Escribir los cambios de vuelta al archivo
fs.writeFileSync(studentRoutesPath, content, 'utf8');

console.log('✅ Se han actualizado las consultas SQL en studentRoutes.js');
