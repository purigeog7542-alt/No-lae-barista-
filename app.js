// Nor Lae Bunker Coffee - BARISTA-OS (Safe Key Management & Logic)

// Read API key from LocalStorage or Input box to avoid committing Secrets to GitHub
function getOpenWeatherApiKey() {
    const inputKey = document.getElementById("weatherApiKey") ? document.getElementById("weatherApiKey").value.trim() : "";
    return inputKey || localStorage.getItem("OPENWEATHER_API_KEY") || "";
}

function saveApiKeyLocally() {
    const inputKey = document.getElementById("weatherApiKey").value.trim();
    if (inputKey) {
        localStorage.setItem("OPENWEATHER_API_KEY", inputKey);
        alert("บันทึก OpenWeather API Key ลงในเครื่องเรียบร้อยแล้ว!");
        fetchWeatherByLocation();
    }
}

// Global Environment State
let currentTemp = 16.5;
let currentHum = 82.0;

// 1. Weather Fetching via Geolocation API
async function fetchWeatherByLocation() {
    const statusEl = document.getElementById("locationStatus");
    const apiKey = getOpenWeatherApiKey();

    if (!apiKey) {
        if (statusEl) statusEl.innerText = "⚠️ กรุณากรอก OpenWeather API Key ด้านบนเพื่อใช้พิกัดจริง";
        useDefaultWeather();
        return;
    }

    if (!navigator.geolocation) {
        if (statusEl) statusEl.innerText = "อุปกรณ์ไม่รองรับพิกัด GPS";
        useDefaultWeather();
        return;
    }

    if (statusEl) statusEl.innerText = "กำลังค้นหาพิกัด GPS...";

    navigator.geolocation.getCurrentPosition(async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        if (statusEl) statusEl.innerText = `พิกัดสำเร็จ (Lat: ${lat.toFixed(2)}, Lon: ${lon.toFixed(2)})`;

        try {
            const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error("Weather API Error");

            const data = await response.json();
            currentTemp = data.main.temp;
            currentHum = data.main.humidity;

            updateWeatherUI();
            calculateGrind();
        } catch (error) {
            console.warn("API Error, using fallback:", error);
            if (statusEl) statusEl.innerText = "ไม่สามารถเชื่อมต่อ Weather API ได้ (ใช้ค่าสำรอง)";
            useDefaultWeather();
        }
    }, (error) => {
        console.warn("GPS Permission Denied/Failed:", error);
        if (statusEl) statusEl.innerText = "ไม่สามารถเข้าถึง GPS ได้ (ใช้ค่าสำรอง)";
        useDefaultWeather();
    }, { timeout: 10000 });
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

    let baseGrind = 1.8; 
    if (profile === 'light') baseGrind = 1.1;
    if (profile === 'dark') baseGrind = 2.4;

    let roastAdjustment = 0.0;
    let alertText = "";

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

    let weatherAdjustment = 0.0;
    if (currentHum > 70.0) {
        weatherAdjustment += 0.3; 
        alertText += `☁️ ความชื้นสูง (>70% RH): บดหยาบ + Pre-infusion 7s`;
    } else if (currentHum < 40.0) {
        weatherAdjustment -= 0.1; 
        alertText += `☀️ อากาศแห้ง (<40% RH): เตือนพ่นสเปรย์ RDT`;
    } else {
        alertText += `🌤️ สภาพอากาศปกติ`;
    }

    if (currentTemp < 18.0) {
        alertText += ` | ❄️ อากาศหนาว (<18°C): เพิ่ม PID Temp +1°C`;
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

// Auto Load Saved API Key
window.onload = () => {
    const savedKey = localStorage.getItem("OPENWEATHER_API_KEY");
    if (savedKey && document.getElementById("weatherApiKey")) {
        document.getElementById("weatherApiKey").value = savedKey;
    }
    const d = new Date();
    d.setDate(d.getDate() - 10);
    if (document.getElementById("roastDate")) {
        document.getElementById("roastDate").value = d.toISOString().split('T')[0];
    }
    fetchWeatherByLocation();
};

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW Registered:', reg.scope))
            .catch(err => console.log('SW Fail:', err));
    });
}
