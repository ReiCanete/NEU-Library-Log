export const validateStudentId = (id: string): boolean => {
  return /^\d{2}-\d{5}-\d{3}$/.test(id);
};

export const validateNEUEmail = (email: string): boolean => {
  return email.endsWith('@neu.edu.ph');
};

export const validateFullName = (name: string): boolean => {
  const trimmed = name.trim();
  return trimmed.length >= 3 && /^[a-zA-ZÀ-ÿ\s'-]+$/.test(trimmed);
};

export const validateBlockReason = (reason: string): boolean => {
  return reason.trim().length >= 10;
};
