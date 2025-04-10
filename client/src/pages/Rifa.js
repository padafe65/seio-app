    import React, { useState, useEffect } from 'react';
    import axios from 'axios';
    import { useCallback } from "react";
    import { useAuth } from '../context/AuthContext';
    import 'bootstrap/dist/css/bootstrap.min.css';
    //import Swal from 'sweetalert2';
    //import withReactContent from 'sweetalert2-react-content';

    //const notiMySwal = withReactContent(Swal);

    const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

    const formatearPesos = (monto) =>
      monto.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    
    const Rifa = () => {
      //const { usuario } = useAuth();
      const [numeros, setNumeros] = useState([]);
      const [totalPago, setTotalPago] = useState(0);
      const [rifas, setRifas] = useState([]);
      const { usuario, userRole } = useAuth();
      const [cargando, setCargando] = useState(true);
      //const [imagenesPago, setImagenesPago] = useState({});
      const [filaActivaParaPago, setFilaActivaParaPago] = useState(null);
      const [imagenesSeleccionadas, setImagenesSeleccionadas] = useState({});
      // Por estas:
      const [mensajesPorRifa, setMensajesPorRifa] = useState({});
      const [verComprobantePorRifa, setVerComprobantePorRifa] = useState({});

      const pagarRifa1 = (id) => {
        setFilaActivaParaPago(id); // Habilita la subida solo en esta fila
      };
      
      const manejarCambioImagen = (e, rifaId) => {
        const file = e.target.files[0];
        setImagenesSeleccionadas((prev) => ({
          ...prev,
          [rifaId]: file
        }));
      };
      

      const subirComprobantePago = async (rifaId) => {
        const imagen = imagenesSeleccionadas[rifaId];
        if (!imagen) {
          setMensajesPorRifa((prev) => ({ ...prev, [rifaId]: "❌ Debes seleccionar una imagen primero." }));
          return;
        }
      
        const formData = new FormData();
        formData.append("imagen", imagen);
      
        try {
          const respuesta = await axios.post(`${API_URL}/api/subir-comprobante/${rifaId}`, formData);
          
          setMensajesPorRifa((prev) => ({ ...prev, [rifaId]: "✅ Comprobante subido con éxito." }));
          setVerComprobantePorRifa((prev) => ({ ...prev, [rifaId]: true }));
          cargarRifas();
          setFilaActivaParaPago(null);
          // Opcional: si deseas refrescar la lista completa
        } catch (error) {
          console.error("Error al subir el comprobante:", error);
          setMensajesPorRifa((prev) => ({ ...prev, [rifaId]: "❌ Hubo un error al subir el comprobante." }));
        }
      };
      
      

    // Definir cargarRifas con useCallback para evitar cambios en cada renderizado
    const cargarRifas = useCallback(async () => {
      try {
          let response;

          //console.log("👤 Rol detectado:", usuario?.rol); // Debug

          if (usuario?.rol === "admin") { 
          
              response = await axios.get(`${API_URL}/api/rifas`);
              
          } else {
          
              response = await axios.get(`${API_URL}/api/rifa/listar/${usuario.id}`);
              
          }

          setRifas(response.data);
      } catch (error) {
          console.error("Error al cargar rifas:", error);
      }
    }, [userRole, usuario?.id]);

    useEffect(() => {
      if (usuario) {
        cargarRifas();
        setCargando(false);
      }
    }, [usuario, cargarRifas]);    
    

      const generarNumero = () => {
        const nuevoNumero = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        setNumeros([...numeros, nuevoNumero]);
        setTotalPago(totalPago + parseInt(nuevoNumero, 10));
      };

      const guardarNumeros = async () => {
        console.log("Estado actual:", usuario); // Verifica el usuario autenticado
        if (numeros.length === 0) {
          alert("Debes generar al menos un número antes de guardar.");
          return;
        }

        try {

          console.log("📤 Enviando datos al servidor:", {
            usuario_id: usuario.id,
            numeros,
            totalPago
        });

          const response = await axios.post(`${API_URL}/api/rifa/guardar`, {
            usuario_id: usuario.id,
            numeros,
            totalPago
          });

          alert(response.data.message);
          setNumeros([]);
          setTotalPago(0);
          cargarRifas();
        } catch (error) {
          console.error("Error al guardar números:", error);
          alert("Hubo un error al guardar los números.");
        }
      };

      const pagarRifa = async (id) => {
        try {
          await axios.put(`${API_URL}/api/rifa/pagar/${id}`);
          alert("Pago realizado con éxito");
          cargarRifas();
        } catch (error) {
          console.error("Error al pagar:", error);
          alert("Hubo un error al procesar el pago.");
        }
      };

      return (
        <div className="container mt-5">
          <h2>Participar en la Rifa</h2>
          <button className="btn btn-success" onClick={generarNumero}>Generar Número</button>
          <button className="btn btn-primary ms-2" onClick={guardarNumeros}>Guardar Números</button>

          <div className="mt-3">
            <h4>Números Jugados:</h4>
            {numeros.map((num, index) => (
              <span key={index} className="badge bg-primary me-2">{num}</span>
            ))}
          </div>

            <h3>Total a pagar: ${formatearPesos(totalPago)}</h3>
            {totalPago < 1000 && <p className="text-danger">Por favor jugar almennos un o unos números más  hasta alcanzar una suma de los números juagados igual o mayor a  $1000 pesos si lo desea</p>}
            
            <h3>Rol detectado: {usuario.rol}</h3>
            <h3>Usuario en la sesión: {usuario.nombre}</h3>
            <h3>Id Usuario: {usuario.id}</h3>
            
          <h2 className="mt-5">Historial de Rifas</h2>

          <table className="table table-bordered table-striped table-hover text-center align-middle">

            <thead>
            <tr style={{ backgroundColor: '#198754', color: 'white', textAlign: 'center' }}>
                <th>Id rifa</th>
                <th>Usuario</th>
                <th>Usuario Id</th>
                <th>Números</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Fecha</th>              
                <th>Acciones</th>
                <th>Imagen</th>
              </tr>
            </thead>
            <tbody>
              {rifas.map((rifa) => (
                <tr key={rifa.id} style={{ backgroundColor: 'red', color: 'white', fontSize: 16, textAlign: 'center', verticalAlign: 'middle' }}>
                  <td>{rifa.id}</td>
                  <td>{rifa.nombre_usuario || usuario.nombre}</td>
                  <td>{rifa.usuario_id || "No disponible"}</td>
                  <td>{JSON.parse(rifa.numeros).join(', ')}</td>
                  <td>${rifa.monto_total}</td>
                  <td>{rifa.estado}</td>
                  <td>{rifa.fecha}</td>
                  <td>
                    {rifa.estado === "Debe" && filaActivaParaPago !== rifa.id && (
                      <button className="btn btn-warning btn-sm"
                        onClick={() => pagarRifa1(rifa.id)}>
                        Pagar
                      </button>
                    )}

                    {rifa.estado === "Debe" && filaActivaParaPago === rifa.id && (
                      <>
                        <input type="file" accept="image/*" className="form-control mb-2"
                          onChange={(e) => manejarCambioImagen(e, rifa.id)} />
                        <button className="btn btn-success btn-sm"
                          onClick={() => subirComprobantePago(rifa.id)}>
                          Subir Comprobante
                        </button>
                      </>
                    )}

                    {rifa.estado === "Cancelado" && rifa.imagen_pago && (
                      <a href={`${API_URL}/uploads/${rifa.imagen_pago}`} 
                        target="_blank" rel="noopener noreferrer"
                        className="btn btn-info btn-sm">
                        Ver Comprobante                        
                      </a>                      
                    )}
                  </td> 
                  <td style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    {rifa.imagen_pago ? (
                      <img
                        src={`${API_URL}/uploads/${rifa.imagen_pago}`}
                        alt="Comprobante"
                        width={60}
                        height={55}
                        style={{ alignItems: 'center', paddingLeft: 3 }}
                      />
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'gray' }}>Sin comprobante</span>
                    )}
                  </td>                 
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    };

    export default Rifa;

