const { GoogleGenerativeAI } = require("@google/generative-ai");

// REEMPLAZA ESTO con tu API Key real
const API_KEY = "AIzaSyAtoWdBMWMY_n3baNvouaQOHK_9JGXkv64"; 

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

async function testConnection() {
  try {
    const prompt = "Responde solo con la palabra: 'Activa'.";
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log("-----------------------------------------");
    console.log("✅ ¡Conexión exitosa!");
    console.log("Respuesta de la API:", text);
    console.log("-----------------------------------------");
  } catch (error) {
    console.error("❌ Error al validar la API Key:");
    console.error(error.message);
  }
}

testConnection();