import 'dotenv/config';
import process from 'node:process';
import AdmZip from 'adm-zip';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const geonamesUrl = 'https://download.geonames.org/export/dump/cities5000.zip';
async function main() {
    console.log('Downloading GeoNames cities5000 dataset...');
    const response = await fetch(geonamesUrl);
    if (!response.ok) {
        throw new Error('Failed to download GeoNames dataset.');
    }
    const zip = new AdmZip(Buffer.from(await response.arrayBuffer()));
    const entry = zip.getEntry('cities5000.txt');
    if (!entry) {
        throw new Error('cities5000.txt was not found in the downloaded archive.');
    }
    const rows = entry.getData().toString('utf8').split('\n').filter(Boolean).map(function mapLine(line) {
        const columns = line.split('\t');
        return {
            geonameId: Number(columns[0]),
            name: columns[1],
            asciiName: columns[2] || columns[1],
            latitude: columns[4],
            longitude: columns[5],
            countryCode: columns[8],
            adminName1: columns[10] || '',
            timezone: columns[17] || '',
            population: columns[14] ? BigInt(columns[14]) : null,
            isActive: true
        };
    });
    console.log(`Importing ${rows.length} reference cities...`);
    for (let index = 0; index < rows.length; index += 1000) {
        await prisma.referenceCity.createMany({
            data: rows.slice(index, index + 1000),
            skipDuplicates: true
        });
    }
    console.log('Reference city import complete.');
}
main()
    .catch(async function handleError(error) {
    console.error(error);
    process.exitCode = 1;
})
    .finally(async function disconnect() {
    await prisma.$disconnect();
});
