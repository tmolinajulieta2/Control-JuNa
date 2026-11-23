const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3000/api/pregnancy';

export async function fetchFamilySpace(familyCode) {
  const cleanCode = encodeURIComponent((familyCode || '').toUpperCase().trim());
  const res = await fetch(`${API_BASE_URL}/${cleanCode}`);
  if (!res.ok) {
    throw new Error(`Error al obtener datos del espacio familiar (${res.status})`);
  }
  return res.json();
}

export async function syncFamilySpace(familyCode, payload) {
  const cleanCode = encodeURIComponent((familyCode || '').toUpperCase().trim());
  const res = await fetch(`${API_BASE_URL}/${cleanCode}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Error al sincronizar datos (${res.status})`);
  }
  return res.json();
}

export async function postStudyComment(familyCode, studyId, comment) {
  const cleanCode = encodeURIComponent((familyCode || '').toUpperCase().trim());
  const cleanStudyId = encodeURIComponent(studyId);
  const res = await fetch(
    `${API_BASE_URL}/${cleanCode}/studies/${cleanStudyId}/comments`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(comment),
    },
  );
  if (!res.ok) {
    throw new Error(`Error al enviar comentario (${res.status})`);
  }
  return res.json();
}