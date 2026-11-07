// Nor Lae Bunker Coffee - BARISTA-OS (Auto GPS via Open-Meteo & Supabase)

// Supabase Configuration
const SUPABASE_URL = "https://punvjllkjbejiycbcgxw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1bnZqbGxramJlaml5Y2JjZ3h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQwNjIwNjcsImV4cCI6MjEwOTYzODA2N30.Sn8yDLnO2yn9kFhh9ftHsb_SfWZNr4GKLfOb56dlzn4";

let supabaseClient = null;
if (typeof supabase !== 'undefined') {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// Global Environment State (Default Bunker Values)
let currentTemp = 16.5; 
let currentHum = 82.0;  

// 1. Weather Fetching via Geolocation API & Open-Meteo (No API Key Needed)
async function fetchWeatherByLocation() {
    const statusEl = document.getElementById("locationStatus");

    if (!navigator.geolocation) {
        if (statusEl) statusEl.innerText = "อุปกรณ์ไม่รองรับ GPS (ใช้ค่าสำรองหน้าดอย)";
        useDefaultWeather();
        return;
    }

    if (statusEl) statusEl.innerText = "กำลังค้นหาพิกัด GPS...";

    navigator.geolocation.getCurrentPosition(async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        try {
            // Open-Meteo Free API (ไม่จำกัดคีย์/ไม่ต้องใช้ API Key)
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m`;
            const response = await fetch(url);
            if (!response.ok) throw new Error("Open-Meteo Fetch Error");

            const data = await response.json();
            currentTemp = data.current.temperature_2m;
            currentHum = data.current.relative_humidity_2m;

            if (statusEl) statusEl.innerText = `พิกัด GPS สำเร็จ (${lat.toFixed(2)}, ${lon.toFixed(2)})`;
            updateWeatherUI();
            calculateGrind();
        } catch (error) {
            console.warn("Weather Fetch Failed, using Bunker Fallback:", error);
            if (statusEl) statusEl.innerText = "ดึงสภาพอากาศไม่สำเร็จ (ใช้ค่าสำรองหน้าดอย)";
            useDefaultWeather();
        }
    }, (error) => {
        console.warn("GPS Permission Denied or Timeout:", error);
        if (statusEl) statusEl.innerText = "ไม่สามารถเข้าถึง GPS ได้ (ใช้ค่าสำรองหน้าดอย)";
        useDefaultWeather();
    }, { timeout: 8000, enableHighAccuracy: true });
}

function useDefaultWeather() {
    currentTemp = 16.5;
    currentHum = 82.0;
    updateWeatherUI();
    calculateGrind();
}

function updateWeatherUI() {
    const tempEl = document.getElementById("tempVal");
    const humEl = document.getElementById("humVal");
    if (tempEl) tempEl.innerText = `${currentTemp.toFixed(1)} °C`;
    if (humEl) humEl.innerText = `${currentHum.toFixed(1)} %`;
}

// 2. Master Calibration Logic (Target: 40 ml / ~40g)
function calculateGrind() {
    const profileEl = document.getElementById("roastProfile");
    const roastDateEl = document.getElementById("roastDate");
    if (!profileEl) return;

    const profile = profileEl.value;
    const roastDateVal = roastDateEl ? roastDateEl.value : null;

    // Timemore Bricks 01S Base Grind Scale (0.01mm/step)
    let baseGrind = 1.8; 
    if (profile === 'light') baseGrind = 1.1;
    if (profile === 'dark') baseGrind = 2.4;

    let roastAdjustment = 0.0;
    let alertText = "";

    // Degassing Calculation
    if (roastDateVal) {
        const roastDate = new Date(roastDateVal);
        const today = new Date();
        const diffDays = Math.floor((today - roastDate) / (1000 * 60 * 60 * 24));

        if (diffDays >= 0 && diffDays <= 7) {
            roastAdjustment += 0.25; 
            alertText += `⚠️ คั่วใหม่ (${diffDays} วัน): บดหยาบขึ้นไล่ก๊าซ | `;
        } else if (diffDays > 21) {
            roastAdjustment -= 0.2; 
            alertText += `⚠️ คั่วนาน (${diffDays} วัน): ลดเบอร์บดเล็กน้อย | `;
        } else {
            alertText += `✨ Peak Flavor Period | `;
        }
    }

    // Weather Compensation Logic
    let weatherAdjustment = 0.0;
    if (currentHum > 70.0) {
        weatherAdjustment += 0.3; // ความชื้นสูง/หมอกจัด -> บดหยาบป้องกันตัน
        alertText += `☁️ ความชื้นสูง (>70% RH): บดหยาบ + Pre-infusion 7s`;
    } else if (currentHum < 40.0) {
        weatherAdjustment -= 0.1; 
        alertText += `☀️ อากาศแห้ง (<40% RH): เตือนพ่นสเปรย์ RDT`;
    } else {
        alertText += `🌤️ สภาพอากาศปกติ`;
    }

    if (currentTemp < 18.0) {
        alertText += ` | ❄️ อากาศหนาว (<18°C): เพิ่ม PID Temp +1°C (อุ่นด้าม 58mm)`;
    }

    let finalGrind = baseGrind + roastAdjustment + weatherAdjustment;
    finalGrind = Math.max(0.5, Math.min(4.0, finalGrind));

    const recEl = document.getElementById("recommendGrind");
    const reasonEl = document.getElementById("adjustReason");
    const alertEl = document.getElementById("extraAlert");

    if (recEl) recEl.innerText = finalGrind.toFixed(2);
    if (reasonEl) reasonEl.innerText = `Base(${baseGrind}) + คั่ว(${roastAdjustment.toFixed(2)}) + สภาพอากาศ(${weatherAdjustment.toFixed(2)})`;
    if (alertEl) alertEl.innerText = alertText;
}

// 3. Supabase Log Insertion Function
async function saveLogToSupabase() {
    const recEl = document.getElementById("recommendGrind");
    const yieldEl = document.getElementById("targetYield");
    const profileEl = document.getElementById("roastProfile");
    const roastDateEl = document.getElementById("roastDate");

    const grindVal = recEl ? parseFloat(recEl.innerText) : 1.8;
    const targetVal = yieldEl ? parseFloat(yieldEl.value) : 40.0;
    const profile = profileEl ? profileEl.value : 'medium';
    const roastDateVal = roastDateEl ? roastDateEl.value : null;

    if (!supabaseClient) {
        alert("ยังไม่ได้ตั้งค่าเชื่อมต่อกับ Supabase ให้ถูกต้อง");
        return;
    }

    const { data, error } = await supabaseClient
        .from('brew_logs')
        .insert([
            {
                bean_name: "Nor Lae House Blend",
                roast_profile: profile,
                roast_date: roastDateVal,
                grind_size: grindVal,
                target_yield_g: targetVal,
                ambient_temp: currentTemp,
                ambient_humidity: currentHum
            }
        ]);

    if (error) {
        alert("บันทึกไม่สำเร็จ: " + error.message);
    } else {
        alert("บันทึกสถิติช็อต 40g ลง Supabase สำเร็จ!");
    }
}

// Auto Load & Initialize
window.onload = () => {
    const d = new Date();
    d.setDate(d.getDate() - 10);
    if (document.getElementById("roastDate")) {
        document.getElementById("roastDate").value = d.toISOString().split('T')[0];
    }
    fetchWeatherByLocation();
};

// Register Service Worker for Offline PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW Registered:', reg.scope))
            .catch(err => console.log('SW Fail:', err));
    });
}
