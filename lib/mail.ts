import nodemailer from "nodemailer";

// MailHog en dev (localhost:1025); en otra plataforma, variables SMTP_* reales.
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "localhost",
  port: Number(process.env.SMTP_PORT ?? 1025),
  secure: false,
});

export async function sendMail(to: string, subject: string, html: string) {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM ?? "no-reply@bonos.local",
    to,
    subject,
    html,
  });
}

export async function sendMagicLink(email: string, url: string) {
  await sendMail(
    email,
    "Tu enlace de acceso a Bonos Corporativos",
    `<p>Entra con este enlace (caduca en 15 minutos):</p>
     <p><a href="${url}">${url}</a></p>`
  );
}
