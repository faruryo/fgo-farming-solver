import NextAuth from 'next-auth'
import Twitter from 'next-auth/providers/twitter'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Twitter({
      clientId: process.env.TWITTER_CLIENT_ID,
      clientSecret: process.env.TWITTER_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    session: ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        id: token.sub,
      },
    }),
  },
  // In v5, NEXTAUTH_SECRET is AUTH_SECRET. 
  // If the user has NEXTAUTH_SECRET, we can map it here just in case.
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
})
