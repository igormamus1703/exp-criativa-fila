import 'dotenv/config';
import nodemailer from 'nodemailer';

// Configuração do transporter do Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Função para enviar email de notificação
export const sendNotificationEmail = async (patientEmail, patientName) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: patientEmail,
      subject: 'Sua vez chegou! - Notificação da Fila',
      html: `
        <h1>Olá ${patientName}!</h1>
        <p>É sua vez de ser atendido(a).</p>
        <p>Por favor, dirija-se ao consultório para seu atendimento.</p>
        <p>Atenciosamente,<br>Equipe Médica</p>
      `
    });
    console.log('✅ Email de notificação enviado com sucesso para:', patientEmail);
    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar email de notificação:', error.message);
    return false;
  }
};

// Exporta o transporter caso seja necessário usar em outros lugares
export default transporter; 