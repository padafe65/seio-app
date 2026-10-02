import { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';

export default function useTeacherCourseContext(user) {
  const [context, setContext] = useState({ subjects: [], courses: [] });

  useEffect(() => {
    if (user?.role !== 'docente' || !user.id) {
      setContext({ subjects: [], courses: [] });
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const teacherResponse = await axiosClient.get(`/teachers/by-user/${user.id}`);
        const teacher = teacherResponse.data?.data || teacherResponse.data;
        if (!teacher?.id) return;
        const response = await axiosClient.get(`/indicators/templates/teacher-context/${teacher.id}`);
        if (!cancelled) setContext(response.data?.data || { subjects: [], courses: [] });
      } catch (error) {
        if (!cancelled) setContext({ subjects: [], courses: [] });
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user?.id, user?.role]);

  return context;
}
