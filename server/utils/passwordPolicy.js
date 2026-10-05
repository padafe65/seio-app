export const isValidPassword = (password) =>
  typeof password === 'string' && password.length >= 8 && /[^\p{L}\p{N}]/u.test(password);

export const PASSWORD_REQUIREMENTS = 'La contraseña debe tener al menos 8 caracteres e incluir al menos un carácter especial.';
