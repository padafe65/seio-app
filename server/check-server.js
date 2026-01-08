#!/usr/bin/env node

/**
 * Script para verificar el estado del servidor y las rutas
 */

import http from 'http';

const checkServerStatus = async () => {
  console.log('🔍 Verificando estado del servidor...\n');

  try {
    const response = await new Promise((resolve, reject) => {
      const req = http.request('http://localhost:5000/api/test', (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            data: body
          });
        });
      });
      req.on('error', reject);
      req.end();
    });

    console.log(`✅ Servidor respondiendo - Status: ${response.status}`);
    console.log(`📄 Respuesta: ${response.data}`);
    
    // Probar una ruta específica
    console.log('\n🔍 Probando ruta de mejora...');
    const improvementResponse = await new Promise((resolve, reject) => {
      const req = http.request('http://localhost:5000/api/improvement-plans', (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            data: body
          });
        });
      });
      req.on('error', reject);
      req.end();
    });

    console.log(`📊 Ruta improvement-plans - Status: ${improvementResponse.status}`);
    
    if (improvementResponse.status === 200) {
      console.log('✅ Las rutas de improvement-plans están funcionando');
    } else {
      console.log('❌ Problema con las rutas de improvement-plans');
    }

  } catch (error) {
    console.log(`❌ Error conectando al servidor: ${error.message}`);
    console.log('💡 Asegúrate de que el servidor esté corriendo en el puerto 5000');
  }
};

checkServerStatus().catch(console.error);
