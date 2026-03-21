import { PrismaClient } from '@prisma/client';
let prismaClient = null;
export function getPrismaClient() {
    if (!prismaClient) {
        prismaClient = new PrismaClient();
    }
    return prismaClient;
}
