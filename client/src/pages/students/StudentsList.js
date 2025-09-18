import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  School as SchoolIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Chip,
  Alert,
  Snackbar
} from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import api from '../../config/axios';

const StudentsList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });
  
  const fetchStudents = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/students');
      setStudents(response.data);
    } catch (error) {
      console.error('Error al cargar estudiantes:', error);
      setError('No se pudieron cargar los estudiantes. Por favor, intente de nuevo.');
      showSnackbar('Error al cargar estudiantes', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    if (user?.role === 'admin') {
      fetchStudents();
    } else {
      // Redirigir si no es administrador
      navigate('/dashboard');
    }
  }, [user, navigate]);
  
  const handleDelete = async (id) => {
    if (window.confirm('¿Está seguro de que desea eliminar este estudiante? Esta acción no se puede deshacer.')) {
      try {
        await api.delete(`/api/students/${id}`);
        setStudents(students.filter(student => student.id !== id));
        showSnackbar('Estudiante eliminado correctamente', 'success');
      } catch (error) {
        console.error('Error al eliminar estudiante:', error);
        showSnackbar('Error al eliminar el estudiante', 'error');
      }
    }
  };
  
  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({
      open: true,
      message,
      severity
    });
  };
  
  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };
  
  const filteredStudents = students.filter(student => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (student.user_name || '').toLowerCase().includes(searchLower) ||
      (student.user_email || '').toLowerCase().includes(searchLower) ||
      (student.grade || '').toString().includes(searchLower) ||
      (student.course_name || '').toLowerCase().includes(searchLower)
    );
  });
  
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }
  
  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }
  
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Gestión de Estudiantes
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          component={Link}
          to="/estudiantes/nuevo"
        >
          Nuevo Estudiante
        </Button>
      </Box>
      
      <Paper sx={{ p: 2, mb: 3 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Buscar estudiantes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Paper>
      
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Grado</TableCell>
                <TableCell>Curso</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student) => (
                  <TableRow key={student.id} hover>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        <PersonIcon color="action" sx={{ mr: 1 }} />
                        {student.user_name}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        <EmailIcon color="action" sx={{ mr: 1, fontSize: 20 }} />
                        {student.user_email}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        <SchoolIcon color="action" sx={{ mr: 1, fontSize: 20 }} />
                        {student.grade}°
                      </Box>
                    </TableCell>
                    <TableCell>
                      {student.course_name || 'Sin asignar'}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={student.user_estado === 'activo' ? 'Activo' : 'Inactivo'}
                        color={student.user_estado === 'activo' ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton 
                        component={Link} 
                        to={`/estudiantes/editar/${student.id}`}
                        color="primary"
                        size="small"
                        sx={{ mr: 1 }}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton 
                        color="error"
                        size="small"
                        onClick={() => handleDelete(student.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                    <Typography color="textSecondary">
                      {searchTerm ? 'No se encontraron estudiantes que coincidan con la búsqueda' : 'No hay estudiantes registrados'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
      
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default StudentsList;
