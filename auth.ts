import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/db/prisma";
import CredentialsProvider from 'next-auth/providers/credentials';
import { compareSync } from "bcrypt-ts-edge";
import type { NextAuthConfig } from "next-auth";
//import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";


export const config = {
    pages: {
        signIn: '/sign-in',
        error: '/sign-in'
    },
    session: {
        strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    adapter: PrismaAdapter(prisma),
    providers: [
        CredentialsProvider({
            credentials: {
                email: { type: 'email'},
                password: { type: 'password'}
            },
            async authorize(credentials) {
                if (credentials == null) return null

                // FInd user in database
                const user = await prisma.user.findFirst({
                    where: {
                        email: credentials.email as string
                    }
                });

                // Check if user exists and password matches
                if (user && user.password) {
                    const isMatch = await compareSync(credentials.password as string, user.password);

                    // If paswors is correct, return user
                    if (isMatch) {
                        return {
                            id: user.id,
                            name: user.name,
                            email: user.email,
                            role: user.role
                        }
                    }
                }

                // If user does not exist or passwprd does not match
                return null;
            }
        })
    ],
    callbacks: {
        async session({ session, user, trigger, token }: any) {
            // Set the user ID from the token
             session.user.id = token.sub;
            session.user.role = token.role;
            session.user.name = token.name;

            // If there is an update, set the user name
            if (trigger === 'update') {
                session.user.name = user.name;
            }

            return session;
          },
        async jwt({ token, user, trigger, session }: any) {
            // Assign user fields to token
            if (user) {
                token.id = user.id;
                token.role = user.role;

                // If user has no name, use email as their default name
                if (user.name === 'NO_NAME') {
                    token.name = user.email!.split('@')[0];

                    // Update the user in the database with the new name
                    await prisma.user.update({
                        where: { id: user.id },
                        data: { name: token.name},
                    });
                }

                if (trigger === 'signIn' || trigger === 'signUp') {
                    const cookiesObject = await cookies();
                    const sessionCartId = cookiesObject.get('sessionCartId')?.value;

                    if (sessionCartId) {
                        const sessionCart = await prisma.cart.findFirst({
                            where: { sessionCartId },
                        });

                        if (sessionCart) {
                            // Delete curent user cart
                            await prisma.cart.deleteMany({
                                where: { userId: user.id },
                            });

                            // Assign new cart
                            await prisma.cart.update({
                                where: {id: sessionCart.id},
                                data: { userId: user.id },
                            })
                        }
                    }
                }
            }

            // Handle session updates
            if (session?.user.name && trigger === 'update') {
                token.name = session.user.name;
            }
            return token;
        },
        authorized({request, auth}: any) {
            // Check for session cart id cookie
            if (!request.cookies.get('sessionCartId')) {
                // Generate new session cart id cookie
                const sessionCartId = crypto.randomUUID();

                // Clone the req headers
                const newRequestHeaders = new Headers(request.headers);

                //Create new response and add the new headers
                const response = NextResponse.next({
                    request: {
                        headers: newRequestHeaders,
                    },
                });

                // Set the newly generated sessionCartId in the response cookies
                response.cookies.set('sessionCartId', sessionCartId);

                return response
            } else {
                return true;
            }
        }
    }

} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(config);