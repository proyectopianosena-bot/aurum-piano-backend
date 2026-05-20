const nodemailer = require("nodemailer");

function isConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function aurumTemplate({ title, body, code }) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;background:#080808;font-family:Georgia,serif;color:#f5f5f5;padding:40px 20px;">
  <div style="max-width:480px;margin:0 auto;border:1px solid rgba(201,168,76,0.25);padding:48px 40px;">
    <p style="letter-spacing:0.45em;font-size:11px;color:#C9A84C;margin:0 0 8px;">AURUM PIANO ACADEMY</p>
    <h1 style="font-weight:300;font-size:28px;margin:0 0 24px;color:#fff;">${title}</h1>
    <p style="font-family:sans-serif;font-size:14px;line-height:1.7;color:rgba(255,255,255,0.55);margin:0 0 32px;">${body}</p>
    <p style="font-family:sans-serif;font-size:11px;letter-spacing:0.35em;text-transform:uppercase;color:rgba(255,255,255,0.35);margin:0 0 12px;">Tu código</p>
    <p style="font-size:36px;letter-spacing:0.35em;color:#C9A84C;margin:0;font-weight:300;">${code}</p>
    <p style="font-family:sans-serif;font-size:12px;color:rgba(255,255,255,0.25);margin:32px 0 0;">Válido por 15 minutos. Si no solicitaste esto, ignora este mensaje.</p>
  </div>
</body>
</html>`;
}

async function sendVerificationEmail(to, code, purpose) {
  const isRegister = purpose === "register";
  const subject = isRegister
    ? "Verifica tu email — Aurum Piano Academy"
    : "Recupera tu contraseña — Aurum Piano Academy";
  const title = isRegister ? "Confirma tu correo" : "Restablece tu acceso";
  const body = isRegister
    ? "Ingresa este código en la página de registro para activar tu cuenta de estudiante."
    : "Usa este código para crear una nueva contraseña de forma segura.";

  const html = aurumTemplate({ title, body, code });
  const text = `${title}\n\nCódigo: ${code}\n\nVálido 15 minutos.`;

  if (!isConfigured()) {
    console.log("\n── Aurum Email (modo desarrollo) ──");
    console.log(`Para: ${to}`);
    console.log(`Código: ${code}`);
    console.log(`Asunto: ${subject}\n`);
    return { dev: true };
  }

  const transport = createTransport();
  await transport.sendMail({
    from: process.env.SMTP_FROM || `"Aurum Piano Academy" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
    html,
  });
  return { dev: false };
}

module.exports = { sendVerificationEmail, isConfigured };
