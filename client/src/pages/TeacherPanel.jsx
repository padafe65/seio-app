import TeacherDashboard from './TeacherDashboard';

const TeacherPanel = ({ selectedQuestionnaireId }) => {
  return (
    <div>
      {/* ...otros paneles... */}
      <TeacherDashboard questionnaireId={selectedQuestionnaireId} />
      {/* ...otros paneles... */}
    </div>
  );
};

export default TeacherPanel;