-- Convierte un usuario en administrador (cambia el email):
UPDATE users SET role = 'admin' WHERE email = 'tu@email.com';
