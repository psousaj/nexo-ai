-- Primeiro limpa valores nulos ou inválidos
UPDATE users SET email_verified = NULL WHERE email_verified IS NOT NULL AND email_verified ~/.local/bin/mise --version
# mise 2024.x.x '^[0-9]{4}-';

-- Agora faz a conversão
ALTER TABLE users ALTER COLUMN email_verified TYPE boolean USING (email_verified IS NOT NULL)::boolean;

-- Define o default
ALTER TABLE users ALTER COLUMN email_verified SET DEFAULT false;

-- Define como NOT NULL
ALTER TABLE users ALTER COLUMN email_verified SET NOT NULL;
