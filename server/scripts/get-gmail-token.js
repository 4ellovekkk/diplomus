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
  prompt: 'consent'
});

console.log('\nFollow these steps to get your Gmail refresh token:\n');
console.log('1. Make sure these environment variables are set:');
console.log(`   CLIENT_ID: ${process.env.GOOGLE_CLIENT_ID ? '✓ Set' : '✗ Missing'}`);
console.log(`   CLIENT_SECRET: ${process.env.GOOGLE_CLIENT_SECRET ? '✓ Set' : '✗ Missing'}`);
console.log(`   REDIRECT_URI: ${process.env.GOOGLE_REDIRECT_URI ? '✓ Set' : '✗ Missing'}\n`);

console.log('2. Go to this URL in your browser:', authorizeUrl);
console.log('3. Login with diplomservice724@gmail.com');
console.log('4. After authorization, you will be redirected. Copy the "code" parameter from the URL\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Enter the code here: ', async (code) => {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log('\nSuccess! Add this to your .env file:\n');
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    
    if (tokens.refresh_token) {
      console.log('✓ Refresh token obtained successfully!');
    } else {
      console.log('⚠️  No refresh token returned. Try these steps:');
      console.log('1. Go to https://myaccount.google.com/permissions');
      console.log('2. Remove access for your application');
      console.log('3. Run this script again\n');
    }
  } catch (error) {
    console.error('Error getting tokens:', error.message);
  } finally {
    rl.close();
  }
}); 