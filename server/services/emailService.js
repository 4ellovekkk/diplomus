const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: 'smtp.yandex.ru',
  port: 587,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const emailTemplates = {
  consultation: {
    en: {
      subject: 'Design Consultation Request Confirmation',
      body: (name, service) => `
        Dear ${name},

        Thank you for requesting a design consultation with our team. We have received your request for ${service} service.

        Here's what happens next:
        1. Our design team will review your request
        2. We will contact you within 24 hours to schedule your consultation
        3. During the consultation, we'll discuss your project in detail and provide initial recommendations

        If you have any questions in the meantime, please don't hesitate to contact us.

        Best regards,
        Your Design Team
      `
    },
    ru: {
      subject: 'Подтверждение запроса на консультацию по дизайну',
      body: (name, service) => `
        Уважаемый(ая) ${name},

        Благодарим вас за запрос на консультацию по дизайну с нашей командой. Мы получили ваш запрос на услугу ${service}.

        Что будет дальше:
        1. Наша команда дизайнеров рассмотрит ваш запрос
        2. Мы свяжемся с вами в течение 24 часов для планирования консультации
        3. Во время консультации мы детально обсудим ваш проект и предоставим первоначальные рекомендации

        Если у вас возникнут вопросы, пожалуйста, не стесняйтесь обращаться к нам.

        С наилучшими пожеланиями,
        Ваша команда дизайнеров
      `
    }
  }
};

const sendConsultationEmail = async (to, name, service, locale = 'en') => {
  const template = emailTemplates.consultation[locale] || emailTemplates.consultation.en;
  
  const mailOptions = {
    from: {
      name: 'Print Center',
      address: process.env.EMAIL_USER
    },
    to: to,
    subject: template.subject,
    text: template.body(name, service)
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendConsultationEmail
}; 