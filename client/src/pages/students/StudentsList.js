import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  School as SchoolIcon,
  Email as EmailIcon,
  Person as PersonIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CircularProgress,
  Container,
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
  const [filters, setFilters] = useState({
    name: '',
    email: '',
    course: '',
    grade: '',
    institution: ''  // ✨ AGREGADO: filtro por institución
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });
  
  const fetchStudents = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Verificar que tenemos el token
      const token = localStorage.getItem('authToken');
      if (!token) {
        console.error('❌ No hay token de autenticación disponible');
        setError('No estás autenticado. Por favor, inicia sesión.');
        return;
      }
      
      // api ya tiene /api como baseURL, así que no agregar /api/ de nuevo
      // Verificar la URL completa que se está construyendo
      const url = '/students';
      console.log('🔍 Intentando obtener estudiantes desde:', {
        baseURL: api.defaults.baseURL,
        url: url,
        fullUrl: `${api.defaults.baseURL}${url}`,
        hasToken: !!token
      });
      
      const response = await api.get(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('📋 Respuesta de /api/students:', response.data);
      
      // El backend puede devolver { success: true, data: [...] } o un array directo
      const studentsData = response.data?.data || response.data || [];
      
      // Normalizar los nombres de campos para compatibilidad
      const normalizedStudents = studentsData.map(student => ({
        ...student,
        user_name: student.user_name || student.name,
        user_email: student.user_email || student.email,
        course_name: student.course_name || student.course
      }));
      
      setStudents(normalizedStudents);
      console.log(`✅ ${normalizedStudents.length} estudiantes cargados correctamente`);
    } catch (error) {
      console.error('❌ Error al cargar estudiantes:', error);
      console.error('📌 Detalles del error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url
      });
      setError('No se pudieron cargar los estudiantes. Por favor, intente de nuevo.');
      showSnackbar('Error al cargar estudiantes', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    // Permitir acceso a admin y super_administrador
    if (user?.role === 'admin' || user?.role === 'super_administrador') {
      fetchStudents();
    } else {
      // Redirigir si no es administrador o super administrador
      navigate('/dashboard');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // Filtro general (búsqueda rápida)
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || (
      (student.user_name || '').toLowerCase().includes(searchLower) ||
      (student.user_email || '').toLowerCase().includes(searchLower) ||
      (student.grade || '').toString().includes(searchLower) ||
      (student.course_name || '').toLowerCase().includes(searchLower) ||
      (student.institution || student.user_institution || '').toLowerCase().includes(searchLower)  // ✨ AGREGADO: buscar en institución
    );

    // Filtros específicos
    const matchesName = !filters.name || (student.user_name || '').toLowerCase().includes(filters.name.toLowerCase());
    const matchesEmail = !filters.email || (student.user_email || '').toLowerCase().includes(filters.email.toLowerCase());
    const matchesCourse = !filters.course || (student.course_name || '').toLowerCase().includes(filters.course.toLowerCase());
    const matchesGrade = !filters.grade || (student.grade || '').toString() === filters.grade || (student.grade || '').toString().includes(filters.grade);
    const matchesInstitution = !filters.institution || 
      (student.institution || student.user_institution || '').toLowerCase().includes(filters.institution.toLowerCase());  // ✨ AGREGADO: filtro por institución

    return matchesSearch && matchesName && matchesEmail && matchesCourse && matchesGrade && matchesInstitution;
  });

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilters({ name: '', email: '', course: '', grade: '' });
  };
  
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
        <Box mb={2}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Búsqueda rápida (nombre, email, curso, grado)..."
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
        </Box>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              label="Filtrar por Nombre"
              placeholder="Nombre del estudiante"
              value={filters.name}
              onChange={(e) => handleFilterChange('name', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              label="Filtrar por Email"
              placeholder="Email del estudiante"
              value={filters.email}
              onChange={(e) => handleFilterChange('email', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              label="Filtrar por Curso"
              placeholder="Nombre del curso"
              value={filters.course}
              onChange={(e) => handleFilterChange('course', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              label="Filtrar por Grado"
              placeholder="Ej: 1, 2, 3..."
              value={filters.grade}
              onChange={(e) => handleFilterChange('grade', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              label="Filtrar por Institución"
              placeholder="Nombre de la institución"
              value={filters.institution}
              onChange={(e) => handleFilterChange('institution', e.target.value)}
            />
          </Grid>
        </Grid>
        {(searchTerm || Object.values(filters).some(f => f)) && (
          <Box mt={2} display="flex" justifyContent="flex-end">
            <Button
              variant="outlined"
              size="small"
              onClick={clearFilters}
            >
              Limpiar Filtros
            </Button>
          </Box>
        )}
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
                        to={`/estudiantes/${student.id}/calificaciones`}
                        color="info"
                        size="small"
                        sx={{ mr: 1 }}
                        title="Calificaciones"
                      >
                        <AssessmentIcon />
                      </IconButton>
                      <IconButton 
                        component={Link} 
                        to={`/estudiantes/${student.id}/editar`}
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
