const fs = require("fs");
const path = require("path");
const axios = require("axios");

// Konstanta
const rootDir = __dirname;
const cityRoot = path.join(rootDir, "City");
const provinceRoot = path.join(rootDir, "Province");
const provinceJsonPath = path.join(provinceRoot, "province.json");

const API_KEY = process.env.RAJAONGKIR_API_KEY;
const API_BASE = {
    PROVINCE: "https://rajaongkir.komerce.id/api/v1/destination/province",
    CITY: "https://rajaongkir.komerce.id/api/v1/destination/city",
    DISTRICT: "https://rajaongkir.komerce.id/api/v1/destination/district",
    SUB_DISTRICT: "https://rajaongkir.komerce.id/api/v1/destination/sub-district",
};

// ⚡ Global config
const DELAY = 1000; // 1 detik per request
let requestCount = 0;

// Helper delay
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper buat folder
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`📂 Folder dibuat: ${dirPath}`);
    }
}

// 🔄 Helper untuk load dari file kalau ada, kalau tidak fetch & simpan
async function loadOrFetch(filePath, fetchFn) {
    if (fs.existsSync(filePath)) {
        try {
            const raw = fs.readFileSync(filePath, "utf-8");
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                console.log(`ℹ️ Cache digunakan: ${filePath}`);
                return parsed;
            }
        } catch (err) {
            console.warn(`⚠️ Gagal parse ${filePath}, fetch ulang: ${err.message}`);
        }
    }

    // Fetch baru
    const data = await fetchFn();
    if (data && Array.isArray(data)) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(`✅ Data disimpan: ${filePath}`);
        await delay(DELAY);
        return data;
    }
    return [];
}

// Fetch wrapper dengan limit request
async function limitedFetch(url) {
    requestCount++;
    console.log(`🔎 Request ke-${requestCount}: ${url}`);
    const response = await axios.get(url, { headers: { Key: API_KEY } });
    return response.data?.data || [];
}

// Fetchers
const fetchProvinces = provinceId => limitedFetch(`${API_BASE.PROVINCE}`);
const fetchCity = provinceId => limitedFetch(`${API_BASE.CITY}/${provinceId}`);
const fetchDistricts = cityId => limitedFetch(`${API_BASE.DISTRICT}/${cityId}`);
const fetchSubdistricts = districtId => limitedFetch(`${API_BASE.SUB_DISTRICT}/${districtId}`);

// Main process
async function main() {
    
    if (!fs.existsSync(provinceJsonPath)) {
        console.warn(`⚠️ province.json tidak ditemukan, fetch dari API...`);

        provinces = await fetchProvinces();
        if (!provinces || provinces.length === 0) {
            console.error("❌ Gagal mengambil data province dari API.");
            process.exit(1);
        }

        fs.writeFileSync(provinceJsonPath, JSON.stringify(provinces, null, 2));
        console.log(`✅ province.json disimpan di ${provinceJsonPath}`);
    } else {
        provinces = JSON.parse(fs.readFileSync(provinceJsonPath, "utf-8"));
        console.log(`ℹ️ province.json ditemukan, gunakan cache`);
    }

    for (const prov of provinces) {
        const provinceName = `(${prov.id}) ${prov.name}`;
        console.log(`\n🌍 Memproses provinsi: ${provinceName}`);

        const provinceCityPath = path.join(provinceRoot, provinceName);
        ensureDir(provinceCityPath);

        // --- Cities ---
        const cityJsonPath = path.join(provinceCityPath, "city.json");
        const cities = await loadOrFetch(cityJsonPath, () => fetchCity(prov.id));

        const provinceCityFolder = path.join(provinceCityPath, "City");
        ensureDir(provinceCityFolder);

        for (const city of cities) {
            const cityFolderName = `(${city.id}) ${city.name}`;
            const cityFolderPath = path.join(provinceCityFolder, cityFolderName);
            ensureDir(cityFolderPath);

            // --- Districts ---
            const districtJsonPath = path.join(cityFolderPath, "district.json");
            const districts = await loadOrFetch(districtJsonPath, () =>
                fetchDistricts(city.id)
            );

            const districtFolderRoot = path.join(cityFolderPath, "District");
            ensureDir(districtFolderRoot);

            for (const dist of districts) {
                const distFolderName = `(${dist.id}) ${dist.name}`;
                const distFolderPath = path.join(districtFolderRoot, distFolderName);
                ensureDir(distFolderPath);

                // --- Subdistricts ---
                const subdistrictJsonPath = path.join(distFolderPath, "subdistrict.json");
                await loadOrFetch(subdistrictJsonPath, () => fetchSubdistricts(dist.id));
            }
        }
    }
    process.exit(1)
    console.log(`\n✅ Selesai! Total request: ${requestCount}`);
}

main();
