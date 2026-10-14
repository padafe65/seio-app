import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import 'katex/dist/katex.min.css';
import { extractQuestionsFromPdf } from './pdfQuestionExtractor';
import api from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';
import MathText from '../../components/MathText';
import AuthenticatedQuestionImage from '../../components/AuthenticatedQuestionImage';

const columnsHelp = [
  'enunciado', 'A', 'B', 'C', 'D', 'numero', 'ubicacion_origen', 'imagen_url', 'referencias_imagen', 'notas_derechos'
];

const rowToItem = (row, index) => ({
  position: index + 1,
  source_question_number: row.numero || row.number || index + 1,
  source_location: row.ubicacion_origen || row.source_location || '',
  question_text: row.enunciado || row.question_text || row.question || '',
  option1: row.A || row.option1 || row.a || '',
  option2: row.B || row.option2 || row.b || '',
  option3: row.C || row.option3 || row.c || '',
  option4: row.D || row.option4 || row.d || '',
  correct_answer: row.respuesta_correcta || row.correct_answer || '',
  image_url: row.imagen_url || row.image_url || '',
  image_references: row.referencias_imagen || row.image_references || '',
  rights_notes: row.notas_derechos || row.rights_notes || ''
});

const describeImageReferences = (value) => {
  try {
    const refs = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(refs) || !refs.length) return '';
    return refs.map((ref) => ref.page
      ? `página ${ref.page}: ${ref.note || 'revisar figuras del original'}`
      : `párrafo ${ref.paragraph}: ${(ref.relationship_ids || []).join(', ')}`).join(' · ');
  } catch {
    return String(value || '');
  }
};

const QuestionnaireImportPage = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_administrador';
  const [teachers, setTeachers] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [preview, setPreview] = useState([]);
  const [form, setForm] = useState({
    title: '', subject: 'Matemáticas', category: 'Pre-ICFES', teacher_id: '', file: null
  });
  const [loading, setLoading] = useState(false);
  const [extractProgress, setExtractProgress] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [savingItemId, setSavingItemId] = useState(null);
  const [itemFeedback, setItemFeedback] = useState({});
  const [formulaDrafts, setFormulaDrafts] = useState({});
  const [formulaPreview, setFormulaPreview] = useState({});

  const loadBatches = async () => {
    const response = await api.get('/questionnaire-imports');
    setBatches(response.data?.data || []);
  };

  useEffect(() => {
    loadBatches().catch((err) => setError(err.response?.data?.message || 'No se pudieron cargar los borradores.'));
    if (user?.role !== 'docente') {
      api.get('/teachers/list').then((response) => {
        const list = response.data?.data || response.data || [];
        setTeachers(list);
        if (list.length) setForm((current) => ({ ...current, teacher_id: String(list[0].id) }));
      }).catch(() => setTeachers([]));
    }
  }, [user]);

  const downloadTemplate = () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      columnsHelp,
      ['Ejemplo: Resuelve la situación descrita...', 'Texto opción A', 'Texto opción B', 'Texto opción C', 'Texto opción D', '1', 'Página 1', '', 'Figura 1 (pendiente de asociar)', 'Propia / fuente por verificar']
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Preguntas');
    XLSX.writeFile(workbook, 'plantilla_importacion_preguntas.xlsx');
  };

  const handleFile = async (file) => {
    setError('');
    setMessage('');
    setPreview([]);
    setExtractProgress('');
    if (!file) return;
    const extension = file.name.split('.').pop().toLowerCase();
    if (extension === 'pdf') {
      setLoading(true);
      try {
        const extracted = await extractQuestionsFromPdf(file, ({ page, total, stage }) => setExtractProgress(`${stage}: ${page}/${total}`));
        setForm((current) => ({ ...current, file }));
        setPreview(extracted.items);
        setMessage(`PDF: ${extracted.detected_questions} preguntas candidatas en ${extracted.pages} páginas; OCR aplicado a ${extracted.ocr_pages} páginas. ${extracted.incomplete_choices} preguntas requieren revisar opciones.`);
      } catch (parseError) {
        setError(parseError.message || 'No se pudo extraer el PDF.');
      } finally {
        setLoading(false);
        setExtractProgress('');
      }
      return;
    }
    if (extension === 'docx') {
      try {
        const body = new FormData();
        body.append('file', file);
        const response = await api.post('/questionnaire-imports/extract-docx', body, { headers: { 'Content-Type': 'multipart/form-data' } });
        const items = response.data.items || [];
        setForm((current) => ({ ...current, file }));
        setPreview(items);
        setMessage(`Se detectaron ${response.data.detected_questions} preguntas. ${response.data.incomplete_choices} requieren completar o revisar opciones; las figuras deben asociarse durante la revisión.`);
      } catch (parseError) {
        setError(parseError.response?.data?.message || 'No se pudo extraer el DOCX.');
      }
      return;
    }
    if (!['xlsx', 'xls', 'csv'].includes(extension)) {
      setError('Carga un PDF, DOCX, Excel o CSV.');
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '', raw: false });
      const items = rows.map(rowToItem).filter((item) => item.question_text || item.option1 || item.option2 || item.option3 || item.option4);
      setForm((current) => ({ ...current, file }));
      setPreview(items);
      if (!items.length) setError('No se encontraron preguntas. Revisa los encabezados de la plantilla.');
      else if (items.some((item) => !item.question_text || !item.option1 || !item.option2 || !item.option3 || !item.option4)) {
        setError('Hay filas incompletas. Completa el enunciado y las cuatro opciones antes de importar.');
      }
    } catch (parseError) {
      setError(`No se pudo leer el archivo: ${parseError.message}`);
    }
  };

  const createBatch = async (event) => {
    event.preventDefault();
    if (!preview.length) {
      setError('No hay preguntas para guardar. Selecciona y procesa un archivo primero.');
      return;
    }
    const emptyStatements = preview.flatMap((item, index) => item.question_text?.trim() ? [] : [index + 1]);
    if (emptyStatements.length) {
      setError(`No se guardó el borrador porque faltan enunciados en las preguntas ${emptyStatements.join(', ')}. Completa esos enunciados y vuelve a intentarlo.`);
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await api.post('/questionnaire-imports', {
        title: form.title,
        subject: form.subject,
        category: form.category,
        teacher_id: form.teacher_id,
        source_filename: form.file?.name,
        source_format: form.file?.name.split('.').pop().toLowerCase(),
        items: preview
      });
      setMessage(`Se guardaron ${response.data.data.question_count} preguntas como borrador. No están disponibles para estudiantes.`);
      setForm((current) => ({ ...current, file: null, title: '' }));
      setPreview([]);
      await loadBatches();
      await openBatch(response.data.data.id);
    } catch (requestError) {
      setError(requestError.response?.status === 413
        ? 'La información extraída supera el límite de 10 MB. Divide el archivo en partes más pequeñas e importa cada parte por separado.'
        : requestError.response?.data?.message || 'No se pudo crear el borrador.');
    } finally {
      setLoading(false);
    }
  };

  const openBatch = async (batchId) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/questionnaire-imports/${batchId}`);
      setSelectedBatch(response.data.data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo abrir el borrador.');
    } finally {
      setLoading(false);
    }
  };

  const saveItem = async (item, event) => {
    const data = new FormData(event.currentTarget);
    const answerVerified = data.get('answer_verified') === 'on';
    const reviewStatus = data.get('review_status');
    const answer = String(data.get('correct_answer') || '').toUpperCase();
    setSavingItemId(item.id);
    setItemFeedback((current) => ({ ...current, [item.id]: null }));
    try {
      const response = await api.put(`/questionnaire-imports/${selectedBatch.id}/items/${item.id}`, {
        question_text: data.get('question_text'),
        option1: data.get('option1'), option2: data.get('option2'), option3: data.get('option3'), option4: data.get('option4'),
        correct_answer: answer,
        answer_verified: answerVerified,
        rights_status: data.get('rights_status'),
        rights_notes: data.get('rights_notes'),
        source_location: data.get('source_location'),
        image_url: data.get('image_url'),
        review_status: reviewStatus
      });
      if (response.data?.success !== true) throw new Error(response.data?.message || 'El servidor no confirmó el guardado.');
      const answerMessage = answer
        ? ` La respuesta ${answer} quedó guardada${answerVerified ? ' y marcada como verificada' : ' pendiente de verificar'}.`
        : ' La respuesta correcta continúa pendiente.';
      setItemFeedback((current) => ({ ...current, [item.id]: { type: 'success', text: `Pregunta ${item.position} guardada.${answerMessage}` } }));
      await openBatch(selectedBatch.id);
      await loadBatches();
    } catch (requestError) {
      setItemFeedback((current) => ({
        ...current,
        [item.id]: {
          type: 'danger',
          text: requestError.response?.data?.message || requestError.message || 'No se pudo guardar la pregunta. Revisa la conexión e inténtalo de nuevo.'
        }
      }));
    } finally {
      setSavingItemId(null);
    }
  };

  const publishBatch = async () => {
    if (!selectedBatch || !window.confirm('Se crearán preguntas activas dentro del cuestionario. Confirma que ya verificaste las respuestas y los derechos de cada pregunta aprobada.')) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.post(`/questionnaire-imports/${selectedBatch.id}/publish`);
      setMessage(`Cuestionario activado con ${response.data.published_questions} preguntas. ID: ${response.data.questionnaire_id}.`);
      setSelectedBatch(null);
      await loadBatches();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo activar el cuestionario.');
    } finally {
      setLoading(false);
    }
  };

  const deleteBatch = async (batch) => {
    if (!window.confirm(`Se eliminará el borrador “${batch.title}” y sus preguntas importadas. ¿Continuar?`)) return;
    setLoading(true);
    setError('');
    try {
      await api.delete(`/questionnaire-imports/${batch.id}`);
      setMessage('Borrador eliminado.');
      await loadBatches();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo eliminar el borrador.');
    } finally {
      setLoading(false);
    }
  };

  const summary = useMemo(() => {
    if (!selectedBatch?.items) return null;
    return selectedBatch.items.reduce((state, item) => {
      state[item.review_status] = (state[item.review_status] || 0) + 1;
      return state;
    }, {});
  }, [selectedBatch]);

  return (
    <main className="container-fluid py-3">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h2 className="mb-1">Importar y revisar preguntas</h2>
          <p className="text-muted mb-0">Las importaciones quedan privadas hasta revisar la clave y la procedencia.</p>
        </div>
        <button type="button" className="btn btn-outline-primary" onClick={downloadTemplate}>Descargar plantilla Excel</button>
      </div>

      {message && <div className="alert alert-success" role="status">{message}</div>}
      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      {!selectedBatch && (
        <div className="row g-3">
          <div className="col-xl-7">
    <section className="card">
              <div className="card-header fw-semibold">Crear borrador desde PDF, Word, Excel o CSV</div>
              <div className="card-body">
                <form onSubmit={createBatch}>
                  <div className="row g-3">
                    <div className="col-md-8">
                      <label className="form-label">Nombre del cuestionario</label>
                      <input className="form-control" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Cuestionario Saber 11 de Matemáticas" />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Materia</label>
                      <select className="form-select" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
                        <option>Matemáticas</option><option>Física</option>
                      </select>
                    </div>
                    {user?.role !== 'docente' && (
                      <div className="col-md-6">
                        <label className="form-label">Docente responsable</label>
                        <select className="form-select" required value={form.teacher_id} onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}>
                          <option value="">Selecciona un docente</option>
                          {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name} — {teacher.subject || 'Sin materia'}</option>)}
                        </select>
                      </div>
                    )}
                    <div className="col-12">
                      <label className="form-label">Archivo de preguntas</label>
                      <input className="form-control" type="file" accept=".pdf,.docx,.xlsx,.xls,.csv" onChange={(e) => handleFile(e.target.files?.[0])} required />
                      <small className="text-muted">PDF con texto se extrae directamente; las páginas escaneadas usan OCR local en el navegador. DOCX detecta listas numeradas. Excel/CSV usa una fila por pregunta. Revisa fórmulas, figuras y opciones antes de aprobar.</small>
                    </div>
                  </div>
                  {extractProgress && <div className="progress mt-3"><div className="progress-bar progress-bar-striped progress-bar-animated" style={{ width: '100%' }}>{extractProgress}</div></div>}
                  {preview.length > 0 && <div className="alert alert-info mt-3 mb-0">Vista previa: {preview.length} preguntas candidatas. Las respuestas y derechos quedan pendientes; revisa opciones y figuras antes de aprobar.</div>}
                  {preview.some((item) => item.question_text?.startsWith('[Enunciado dentro de una figura del original;')) && <div className="alert alert-warning mt-2 mb-0">{preview.filter((item) => item.question_text?.startsWith('[Enunciado dentro de una figura del original;')).length} preguntas tienen el enunciado en una figura. Complétalo desde el original después de guardar el borrador.</div>}
                  <button className="btn btn-primary mt-3" disabled={loading || !preview.length || !!error}>{loading ? 'Guardando…' : 'Guardar preguntas como borrador'}</button>
                </form>
              </div>
            </section>
          </div>
          <div className="col-xl-5">
            <section className="card">
              <div className="card-header fw-semibold">Borradores guardados</div>
              <div className="list-group list-group-flush">
                {batches.length === 0 && <div className="list-group-item text-muted">Todavía no hay importaciones.</div>}
                {batches.map((batch) => (
                  <div key={batch.id} className="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2">
                    <button type="button" className="btn btn-link text-start p-0" onClick={() => openBatch(batch.id)}>
                      <strong>{batch.title}</strong><br />
                      <small>{batch.subject} · {batch.question_count} preguntas · {batch.approved_count} aprobadas · {batch.status === 'published' ? 'Publicado' : 'Borrador'}</small>
                    </button>
                    {isSuperAdmin && batch.published_questionnaire_id && <Link className="btn btn-sm btn-outline-success" to={`/cuestionarios/acceso/${batch.published_questionnaire_id}`}>Administrar acceso</Link>}
                    {batch.status === 'draft' && Number(batch.created_by_user_id) === Number(user?.id) && <button type="button" className="btn btn-sm btn-outline-danger" disabled={loading} onClick={() => deleteBatch(batch)}>Eliminar borrador</button>}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {selectedBatch && (
        <section>
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <div>
              <button type="button" className="btn btn-link ps-0" onClick={() => { setSelectedBatch(null); setMessage(''); }}>← Volver a importaciones</button>
              <h3 className="mb-0">{selectedBatch.title}</h3>
              <div className="text-muted">{selectedBatch.subject} · {selectedBatch.items.length} preguntas · Pendientes: {summary?.pending || 0} · Aprobadas: {summary?.approved || 0} · Excluidas: {summary?.rejected || 0}</div>
            </div>
            {isSuperAdmin && Number(selectedBatch.created_by_user_id) === Number(user?.id) && selectedBatch.status === 'draft' && <button type="button" className="btn btn-success" disabled={loading || selectedBatch.items.some((item) => item.review_status === 'pending')} onClick={publishBatch}>Activar cuestionario</button>}
          </div>
          {selectedBatch.items.map((item) => (
            <form key={item.id} className="card mb-3" onChange={() => setItemFeedback((current) => ({ ...current, [item.id]: null }))} onSubmit={(event) => { event.preventDefault(); saveItem(item, event); }}>
              <div className="card-header d-flex justify-content-between align-items-center">
                <strong>Pregunta {item.position}{item.source_question_number ? ` · origen ${item.source_question_number}` : ''}</strong>
                <span className={`badge ${item.review_status === 'approved' ? 'bg-success' : item.review_status === 'rejected' ? 'bg-secondary' : 'bg-warning text-dark'}`}>{item.review_status === 'approved' ? 'Aprobada' : item.review_status === 'rejected' ? 'Excluida' : 'Pendiente'}</span>
              </div>
              <div className="card-body">
                {describeImageReferences(item.image_references) && !item.image_assets?.length && <div className="alert alert-warning py-2">Este borrador conserva referencias a figuras del DOCX, pero no tiene archivos asociados. Aplica la migración de imágenes y vuelve a importar el DOCX para extraerlas; después podrás verlas aquí.</div>}
                {describeImageReferences(item.image_references) && item.image_assets?.length > 0 && <div className="alert alert-info py-2">Figuras extraídas: {item.image_assets.map((asset) => asset.name).join(', ')}</div>}
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label d-flex align-items-center gap-2">Enunciado
                      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setFormulaPreview((current) => ({ ...current, [`${item.id}-question`]: !current[`${item.id}-question`] }))}>{formulaPreview[`${item.id}-question`] ? 'Editar LaTeX' : 'Ver como fórmula'}</button>
                    </label>
                    <textarea className="form-control" name="question_text" rows="3" defaultValue={item.question_text} required style={{ display: formulaPreview[`${item.id}-question`] ? 'none' : undefined }} onChange={(event) => setFormulaDrafts((current) => ({ ...current, [`${item.id}-question`]: event.target.value }))} />
                    {formulaPreview[`${item.id}-question`] && <div className="border rounded bg-light p-3 mt-2" style={{ minHeight: 100, whiteSpace: 'pre-wrap' }}><MathText text={formulaDrafts[`${item.id}-question`] ?? item.question_text} /></div>}
                  </div>
                  {[1, 2, 3, 4].map((number) => {
                    const formulaKey = `${item.id}-option${number}`;
                    const optionValue = formulaDrafts[formulaKey] ?? item[`option${number}`] ?? '';
                    return <div className="col-md-6" key={number}>
                      <label className="form-label d-flex align-items-center gap-2">Opción {String.fromCharCode(64 + number)}
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setFormulaPreview((current) => ({ ...current, [formulaKey]: !current[formulaKey] }))}>{formulaPreview[formulaKey] ? 'Editar LaTeX' : 'Ver como fórmula'}</button>
                      </label>
                      <textarea className="form-control" name={`option${number}`} rows="2" defaultValue={item[`option${number}`]} style={{ display: formulaPreview[formulaKey] ? 'none' : undefined }} onChange={(event) => setFormulaDrafts((current) => ({ ...current, [formulaKey]: event.target.value }))} />
                      {formulaPreview[formulaKey] && <div className="border rounded bg-light p-3" style={{ minHeight: 60, whiteSpace: 'pre-wrap' }}><MathText text={optionValue} assumeLatex /></div>}
                    </div>;
                  })}
                  {item.image_assets?.length > 0 && <div className="col-12"><div className="d-flex flex-wrap gap-3">{item.image_assets.map((asset) => <figure className="border rounded p-2 mb-0" key={asset.id}><AuthenticatedQuestionImage src={asset.url} alt={asset.name} style={{ maxWidth: '100%', maxHeight: 240 }} /><figcaption className="small text-muted mt-1">{asset.name}</figcaption></figure>)}</div></div>}
                  <div className="col-md-3"><label className="form-label">Respuesta correcta</label><select className="form-select" name="correct_answer" defaultValue={item.correct_answer || ''}><option value="">Pendiente</option>{['A', 'B', 'C', 'D'].map((answer) => <option key={answer}>{answer}</option>)}</select></div>
                  <div className="col-md-3 d-flex align-items-end pb-2"><label className="form-check"><input className="form-check-input" type="checkbox" name="answer_verified" defaultChecked={item.answer_status === 'verified'} /> Clave verificada</label></div>
                  <div className="col-md-3"><label className="form-label">Derechos</label><select className="form-select" name="rights_status" defaultValue={item.rights_status}><option value="pending">Pendiente</option><option value="original">Creación propia verificada</option><option value="licensed">Permiso/licencia verificada</option><option value="replaced">Reemplazada por contenido propio</option><option value="exclude">Excluir del cuestionario</option></select></div>
                  <div className="col-md-3"><label className="form-label">Revisión</label><select className="form-select" name="review_status" defaultValue={item.review_status}><option value="pending">Pendiente</option><option value="approved">Aprobar</option><option value="rejected">Excluir</option></select></div>
                  <div className="col-md-6"><label className="form-label">Ubicación o fuente</label><input className="form-control" name="source_location" defaultValue={item.source_location || ''} placeholder="Página, sección o fuente" /></div>
                  <div className="col-md-6"><label className="form-label">URL de imagen asociada</label><input className="form-control" name="image_url" defaultValue={item.image_url || ''} placeholder="Enlace o ruta de imagen ya cargada" /></div>
                  <div className="col-12"><label className="form-label">Notas de procedencia</label><textarea className="form-control" name="rights_notes" rows="2" defaultValue={item.rights_notes || ''} placeholder="Autor, licencia, permiso o acción requerida" /></div>
                </div>
                {itemFeedback[item.id] && <div className={`alert alert-${itemFeedback[item.id].type} mt-3 mb-0`} role={itemFeedback[item.id].type === 'danger' ? 'alert' : 'status'} aria-live="polite">{itemFeedback[item.id].text}</div>}
                <button className="btn btn-outline-primary mt-3" disabled={loading || savingItemId === item.id}>{savingItemId === item.id ? 'Guardando…' : 'Guardar revisión y respuesta'}</button>
              </div>
            </form>
          ))}
        </section>
      )}
    </main>
  );
};

export default QuestionnaireImportPage;
