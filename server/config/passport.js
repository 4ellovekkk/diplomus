/* Dependencies */
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const {PrismaClient} = require("@prisma/client"); // Import PrismaClient
const prisma = new PrismaClient(); // Initialize PrismaClient

/* Passport Middleware */
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID, // Client ID
            clientSecret: process.env.GOOGLE_CLIENT_SECRET, // Client secret
            callbackURL: "https://localhost:3000/auth/google/callback", // Callback URL
        },
        async function (accessToken, refreshToken, profile, done) {
            try {
                console.log(profile);

                // Check if the user already exists in the database using googleId
                let user = await prisma.users.findUnique({
                    where: {
                        goodleId: profile.id, // Use the googleId field from the Prisma schema
                    },
                });

                // If the user doesn't exist, create a new user
                if (!user) {
                    user = await prisma.users.create({
                        data: {
                            goodleId: profile.id, // Store the Google ID
                            username: profile.emails[0].value, // Use email as username
                            email: profile.emails[0].value, // Store the email
                            password_hash: "", // No password for OAuth users
                            role: "customer", // Default role
                        },
                    });
                }

                // Return the user object
                return done(null, user);
            } catch (err) {
                return done(err, null);
            }
        }
    )
);

/* How to store the user information in the session */
passport.serializeUser(function (user, done) {
    done(null, user.id); // Store the user ID in the session
});

/* How to retrieve the user from the session */
passport.deserializeUser(async function (id, done) {
    try {
        const user = await prisma.users.findUnique({
            where: {   goodleId: id, // Find the user by ID
            },
        });
        done(null, user); // Return the user object
    } catch (err) {
        done(err, null);
    }
});

/* Exporting Passport Configuration */
module.exports = passport;