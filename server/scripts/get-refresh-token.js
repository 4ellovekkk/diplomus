require('dotenv').config();
const { google } = require('googleapis');
const readline = require('readline');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Generate the url that will be used for authorization
const authorizeUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/gmail.send'],
  prompt: 'consent',
  include_granted_scopes: false,
  response_type: 'code',
  login_hint: 'diplomservice724@gmail.com', // Pre-fill the email
  state: 'password_reset_auth'
});

console.log('\nImportant Setup Steps:\n');
console.log('1. Verify these environment variables are set correctly:');
console.log(`   CLIENT_ID: ${process.env.GOOGLE_CLIENT_ID ? '✓ Set' : '✗ Missing'}`);
console.log(`   CLIENT_SECRET: ${process.env.GOOGLE_CLIENT_SECRET ? '✓ Set' : '✗ Missing'}`);
console.log(`   REDIRECT_URI: ${process.env.GOOGLE_REDIRECT_URI ? '✓ Set' : '✗ Missing'}\n`);

console.log('2. Make sure you have:');
console.log('   - Added diplomservice724@gmail.com as a test user in Google Cloud Console');
console.log('   - Configured the OAuth consent screen');
console.log('   - Enabled the Gmail API\n');

console.log('3. Go to this URL in your browser:', authorizeUrl);
console.log('4. Login with diplomservice724@gmail.com\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Enter the code from that page here: ', async (code) => {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log('\nSuccess! Add these tokens to your .env file:\n');
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    if (tokens.access_token) {
      console.log(`GOOGLE_ACCESS_TOKEN=${tokens.access_token}`);
    }
  } catch (error) {
    console.error('\nError getting tokens:', error.message);
    if (error.message.includes('invalid_grant')) {
      console.log('\nThe authorization code has expired or is invalid.');
      console.log('Please try again with a new authorization code.');
    }
  } finally {
    rl.close();
  }
});
