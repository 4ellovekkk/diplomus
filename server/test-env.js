require('dotenv').config();

console.log('Environment Variables Test:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('EMAIL_USER:', process.env.EMAIL_USER ? 'set (starts with: ' + process.env.EMAIL_USER.substring(0, 3) + '...)' : 'not set');
console.log('EMAIL_APP_PASSWORD:', process.env.EMAIL_APP_PASSWORD ? 'set (length: ' + process.env.EMAIL_APP_PASSWORD.length + ')' : 'not set'); 