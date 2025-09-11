const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Konstanta
const cityRoot = path.join(__dirname, 'City');
const API_KEY = process.env.RAJAONGKIR_API_KEY;
const API_BASE = 'https://rajaongkir.komerce.id/api/v1/destination/district';


// Ambil semua folder dalam "city"
const cityFolders = fs.readdirSync(cityRoot, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);


// fetch data dari rajaongkir
async function fetchDistricts(cityId) {
    try {
        const response = await axios.get(`${API_BASE}/${cityId}`, {
            headers: { Key: API_KEY }
        });
        return response.data?.data || [];
    } catch (err) {
        console.error(`❌ Gagal fetch district untuk city ID ${cityId}:`, err.message);
        return null;
    }
}


function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


async function main() {


    for (const cityName of cityFolders) {
        
        

        const cityJsonPath = path.join(cityRoot, cityName, 'city.json');
        if (!fs.existsSync(cityJsonPath)) {
            console.warn(`⚠️ File city.json tidak ditemukan: ${cityName}`);
            continue;
        }


        // Baca isi city.json
        const rawData = fs.readFileSync(cityJsonPath, 'utf-8');
        let city;

        try {
            city = JSON.parse(rawData);
        } catch (err) {
            console.error(`❌ Gagal parse JSON untuk ${cityName}:`, err.message);
            return;
        }

        // Path folder districts
        const districtPath = path.join(cityRoot, cityName, 'Districts');

        // Buat folder districts kalau belum ada
        if (!fs.existsSync(districtPath)) {
            fs.mkdirSync(districtPath);
        }


        for (const district of city) {
            await delay(10000); // ⏱️ Delay 1 detik

            const folderName = `(${district.id}) ${district.name}`;
            const fullPath = path.join(districtPath, folderName);

            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath);
                console.log(`✅ ${cityName}: Folder distrik dibuat → ${folderName}`);
            } else {
                console.log(`ℹ️ ${cityName}: Folder sudah ada → ${folderName}`);
            }


            // Path district.json
            const districtJsonPath = path.join(fullPath, 'district.json');


            // 🔍 Cek apakah file district.json sudah ada dan ada isi valid
            if (fs.existsSync(districtJsonPath)) {
                try {
                    const raw = fs.readFileSync(districtJsonPath, 'utf-8');
                    const parsed = JSON.parse(raw);

                    if (parsed && Array.isArray(parsed) && parsed.length > 0) {
                        console.log(`ℹ️ District data sudah ada → skip: ${districtJsonPath}`);
                        continue; // 👉 skip fetch API, lanjut ke district berikutnya
                    }
                } catch (err) {
                    console.warn(`⚠️ Gagal parse district.json di ${districtJsonPath}:`, err.message);
                    // kalau corrupt → tetap fetch ulang
                }
            }



            const districts = await fetchDistricts(district.id);


            fs.writeFileSync(districtJsonPath, JSON.stringify(districts, null, 2));
            console.log(`✅ District data disimpan: ${districtJsonPath}`);
        }


        
    }
}

main();