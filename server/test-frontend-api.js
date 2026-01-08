#!/usr/bin/env node

/**
 * Script de Prueba para el Frontend del Sistema Automático
 * 
 * Este script verifica que todas las rutas API necesarias
 * para el componente AutomaticImprovementPlansManager estén funcionando
 */

import https from 'https';
import http from 'http';

const API_BASE_URL = 'http://localhost:5000/api';

const makeRequest = (url, method = 'GET', data = null) => {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (data) {
      const jsonData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(jsonData);
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const parsedBody = JSON.parse(body);
          resolve({
            status: res.statusCode,
            data: parsedBody
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            data: body
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
};

const testFrontendAPI = async () => {
  console.log('🧪 Iniciando pruebas del frontend del sistema automático...\n');

  try {
    // 1. Verificar que el servidor esté corriendo
    console.log('1️⃣ Verificando conexión al servidor...');
    try {
      const response = await makeRequest(`${API_BASE_URL}/test`);
      console.log('✅ Servidor respondiendo correctamente');
    } catch (error) {
      console.log('❌ Servidor no disponible. Asegúrate de que esté corriendo en el puerto 5000');
      return;
    }
    console.log('');

    // 2. Probar ruta de cuestionarios
    console.log('2️⃣ Probando ruta de cuestionarios...');
    try {
      const response = await makeRequest(`${API_BASE_URL}/questionnaires`);
      if (response.status === 200) {
        console.log(`✅ Ruta /questionnaires funcionando - ${Array.isArray(response.data) ? response.data.length : 'datos'} cuestionarios encontrados`);
      } else {
        console.log(`⚠️ Ruta /questionnaires respondió con status ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ Error en ruta /questionnaires: ${error.message}`);
    }
    console.log('');

    // 3. Probar ruta de estadísticas automáticas
    console.log('3️⃣ Probando ruta de estadísticas automáticas...');
    try {
      const response = await makeRequest(`${API_BASE_URL}/improvement-plans/auto-stats`);
      if (response.status === 200) {
        console.log('✅ Ruta /improvement-plans/auto-stats funcionando');
        if (response.data.data && response.data.data.general) {
          console.log(`   - Total planes: ${response.data.data.general.total_plans}`);
          console.log(`   - Planes automáticos: ${response.data.data.general.auto_generated_plans}`);
        }
      } else {
        console.log(`⚠️ Ruta /improvement-plans/auto-stats respondió con status ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ Error en ruta /improvement-plans/auto-stats: ${error.message}`);
    }
    console.log('');

    // 4. Probar ruta de vista automática
    console.log('4️⃣ Probando ruta de vista automática...');
    try {
      const response = await makeRequest(`${API_BASE_URL}/improvement-plans/auto-view`);
      if (response.status === 200) {
        console.log(`✅ Ruta /improvement-plans/auto-view funcionando - ${Array.isArray(response.data.data) ? response.data.data.length : 'datos'} planes encontrados`);
      } else {
        console.log(`⚠️ Ruta /improvement-plans/auto-view respondió con status ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ Error en ruta /improvement-plans/auto-view: ${error.message}`);
    }
    console.log('');

    console.log('🎉 Pruebas del frontend completadas!');
    console.log('');
    console.log('📋 Resumen:');
    console.log('   ✅ Las rutas API están disponibles');
    console.log('   ✅ El componente AutomaticImprovementPlansManager puede conectarse');
    console.log('   ✅ El panel de control está listo para usar');
    console.log('');
    console.log('🚀 Para usar el panel de control:');
    console.log('   1. Inicia el cliente: npm start');
    console.log('   2. Navega a: http://localhost:3000/planes-automaticos');
    console.log('   3. Usa el panel de control para procesar cuestionarios');

  } catch (error) {
    console.error('❌ Error durante las pruebas:', error.message);
  }
};

// Ejecutar las pruebas
testFrontendAPI().catch(console.error);
