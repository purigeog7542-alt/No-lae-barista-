// ==========================================
// 1. TIMEMORE BRICKS 01S CONFIGURATION
// ==========================================
const BRICKS_CONFIG = {
    name: "Timemore Bricks 01S (40mm S2C040 Conical)",
    workflow: [
        "ใช้ RDT สเปรย์พรมน้ำ 1-2 ละอองบนเมล็ดกาแฟก่อนลง Hopper",
        "กดปุ่มเปิดเครื่องก่อนค่อยเปิดฝาเทเมล็ดกาแฟลงไป",
        "เมื่อบดเสร็จ ให้หมุน Fines Knocker เคาะผงกาแฟค้างช็อตให้ออกหมด"
    ]
};

// ==========================================
// 2. SUPABASE CONFIGURATION
// ==========================================
const SUPABASE_URL = 'https://punvjllkjbeziycbcgxw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1bnZqbGxramJlaml5Y2JjZ3h3Iiwicm9sZSI6InB1bnZhbjEiLCJpYXQiOjE3OTQwNjIwNjcsImV4cCI6MjEwOTYzODA2N30.Sn8yDLnO2yn9kFhh9ftHsb_SfWZNr4GKLfOb56dlzn4';

let supabaseClient = null;
if (window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ==========================================
// 3. WEATHER & GPS (ดึงสภาพอากาศจริงอัตโนมัติ)
// ==========================================
async function fetchWeatherByLocation() {
    const statusEl = document.getElementById('locationStatus');
    const tempValEl = document.getElementById('tempVal');
    const humValEl = document.getElementById('humVal');

    const norLaeLat = 19.9234; 
    const norLaeLon = 99.1512;

    const fetchWeatherAPI = async (lat, lon, sourceLabel) => {
        try {
            const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m`);
            const data = await res.json();
            
            if (data && data.current) {
                if (tempValEl) tempValEl.innerText = `${data.current.temperature_2m} °C`;
                if (humValEl) humValEl.innerText = `${data.current.relative_humidity_2m} %`;
                if (statusEl) {
                    statusEl.innerText = `✅ สำเร็จ (${sourceLabel}): ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
                }
                calculateGrind();
            }
        } catch (err) {
            console.error("Weather fetch error:", err);
            if (statusEl) statusEl.innerText = "⚠️ โหลดสภาพอากาศสำรองสำเร็จ";
            fetchWeatherAPI(norLaeLat, norLaeLon, "ฐานปฏิบัติการบ้านนอแล (Fallback)");
        }
    };

    if (statusEl) statusEl.innerText = "📍 กำลังเชื่อมต่อสภาพอากาศ...";

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                fetchWeatherAPI(position.coords.latitude, position.coords.longitude, "GPS มือถือ");
            }, 
            (error) => {
                console.warn("GPS bypass:", error);
                fetchWeatherAPI(norLaeLat, norLaeLon, "ฐานปฏิบัติการบ้านนอแล");
            }, 
            { timeout: 1500, enableHighAccuracy: false, maximumAge: 60000 }
        );
    } else {
        fetchWeatherAPI(norLaeLat, norLaeLon, "ฐานปฏิบัติการบ้านนอแล");
    }
}

// ==========================================
// 4. DYNAMIC GRIND CALCULATION (วิเคราะห์ค่าจริงอัตโนมัติ)
// ==========================================
function calculateGrind() {
    const roastProfileEl = document.getElementById('roastProfile');
    const roastDateEl = document.getElementById('roastDate');
    const tempValEl = document.getElementById('tempVal');
    const humValEl = document.getElementById('humVal');
    const currentRangeEl = document.getElementById('currentSelectedRange');

    const roastProfile = roastProfileEl ? roastProfileEl.value : 'medium';
    const roastDateVal = roastDateEl ? roastDateEl.value : '';
    const selectedRange = currentRangeEl ? currentRangeEl.innerText.trim() : 'Medium-fine';
    
    const currentTemp = tempValEl ? parseFloat(tempValEl.innerText) || 25 : 25;
    const currentHum = humValEl ? parseFloat(humValEl.innerText) || 60 : 60;

    let baseClicks = 22; 
    
    if (selectedRange === 'Extra-fine') baseClicks = 5;
    else if (selectedRange === 'Fine') baseClicks = 12;
    else if (selectedRange === 'Medium-fine') baseClicks = 22; 
    else if (selectedRange === 'Medium') baseClicks = 38;      
    else if (selectedRange === 'Medium-coarse') baseClicks = 85; 
    else if (selectedRange === 'Coarse') baseClicks = 135;     

    let roastNote = "คั่วกลาง (Medium Roast)";
    if (roastProfile === 'light') {
        baseClicks -= 3; 
        roastNote = "คั่วอ่อน (Light Roast)";
    } else if (roastProfile === 'dark') {
        baseClicks += 4; 
        roastNote = "คั่วเข้ม (Dark Roast)";
    }

    let ageDays = 7;
    if (roastDateVal) {
        const roastDate = new Date(roastDateVal);
        const today = new Date();
        ageDays = Math.floor((today - roastDate) / (1000 * 60 * 60 * 24));
        if (isNaN(ageDays) || ageDays < 0) ageDays = 7;
    }

    let weatherEffectNote = "";
    if (currentTemp > 28) {
        baseClicks += 1;
        weatherEffectNote += `🌡️ อากาศร้อน (${currentTemp}°C) ปรับหยาบขึ้น 1 คลิก | `;
    } else if (currentTemp < 20) {
        baseClicks -= 1;
        weatherEffectNote += `❄️ อากาศเย็น (${currentTemp}°C) ปรับละเอียดขึ้น 1 คลิก | `;
    }

    if (currentHum > 80) {
        baseClicks += 1;
        weatherEffectNote += `💧 ความชื้นสูง (${currentHum}%) ป้องกันผงกาแฟเกาะตัว`;
    }

    let alertMsg = `✨ เมล็ดอยู่ในช่วงเวลาสกัดที่เหมาะสม (${ageDays} วันหลังคั่ว)`;

    if (ageDays < 5) {
        baseClicks += 3; 
        alertMsg = `⚠️ เมล็ดคั่วใหม่ (${ageDays} วัน) แก๊สยังเยอะ ควรบดหยาบขึ้น 3 คลิก`;
    } else if (ageDays > 30) {
        baseClicks = Math.max(1, baseClicks - 2); 
        alertMsg = `ℹ️ เมล็ดคั่วมาแล้ว ${ageDays} วัน เริ่มเก่า ปรับละเอียดขึ้น 2 คลิก`;
    }

    let finalClicks = Math.min(145, Math.max(1, Math.round(baseClicks)));

    const grindNumEl = document.getElementById('recommendGrind');
    const adjustReasonEl = document.getElementById('adjustReason');
    const extraAlertEl = document.getElementById('extraAlert');

    if (grindNumEl) grindNumEl.innerText = `${finalClicks} คลิก`;
    if (adjustReasonEl) {
        adjustReasonEl.innerText = `ช่วง: ${selectedRange} | ${roastNote}, อายุเมล็ด ${ageDays} วัน\nสภาพอากาศ: ${currentTemp}°C / ${currentHum}%`;
    }

    let workflowHtml = BRICKS_CONFIG.workflow.map(w => `<div>• ${w}</div>`).join('');

    if (extraAlertEl) {
        extraAlertEl.innerHTML = `
            <div>${alertMsg}</div>
            ${weatherEffectNote ? `<div style="color: #38bdf8; font-size: 0.75rem; margin-top: 2px;">${weatherEffectNote}</div>` : ''}
            <div style="margin-top: 8px; font-size: 0.72rem; text-align: left; background: rgba(0,0,0,0.3); padding: 8px; border-radius: 6px; border: 1px solid #333;">
                <div style="font-weight: bold; color: var(--accent); margin-bottom: 3px;">💡 Workflow แนะนำ:</div>
                ${workflowHtml}
            </div>
        `;
    }
}

// ==========================================
// 5. SUPABASE LOG STORAGE (พร้อมระบบสำรอง LocalStorage อัตโนมัติ)
// ==========================================
async function saveLogToSupabase() {
    const grindText = document.getElementById('recommendGrind').innerText;
    const grindNumber = parseFloat(grindText.replace(/[^\d.]/g, '')) || 0;

    const logData = {
        bean_name: document.getElementById('beanName').value || "Nor Lae House Blend",
        roast_profile: document.getElementById('roastProfile').value,
        roast_date: document.getElementById('roastDate').value || null,
        grind_size: grindNumber,
        dose_g: parseFloat(document.getElementById('doseG').value) || 0,
        target_yield_g: parseFloat(document.getElementById('targetYield').value) || 0,
        actual_yield_g: parseFloat(document.getElementById('actualYieldG').value) || null,
        pre_infusion_sec: parseFloat(document.getElementById('preInfusionSec').value) || null,
        shot_time_sec: parseFloat(document.getElementById('shotTimeSec').value) || null,
        ambient_temp: parseFloat(document.getElementById('tempVal').innerText) || null,
        ambient_humidity: parseFloat(document.getElementById('humVal').innerText) || null,
        taste_rating: document.getElementById('tasteRating').value || null,
        created_at: new Date().toISOString()
    };

    if (!supabaseClient) {
        saveToLocalFallback(logData);
        return;
    }

    try {
        const { error } = await supabaseClient.from('brew_logs').insert([logData]);
        if (error) throw error;
        
        alert('✅ บันทึกผลการสกัดลง Supabase สำเร็จ!');
        resetLogForm();
    } catch (err) {
        console.warn("Supabase network blocked or offline, saving locally...", err);
        saveToLocalFallback(logData);
    }
}

function saveToLocalFallback(logData) {
    let localLogs = JSON.parse(localStorage.getItem('brew_logs_offline') || '[]');
    localLogs.push(logData);
    localStorage.setItem('brew_logs_offline', JSON.stringify(localLogs));
    alert('⚠️ เครือข่ายบล็อกเซิร์ฟเวอร์: ระบบบันทึกข้อมูลเก็บไว้ในหน่วยความจำเครื่อง (LocalStorage) เรียบร้อยแล้ว');
    resetLogForm();
}

function resetLogForm() {
    document.getElementById('actualYieldG').value = '';
    document.getElementById('preInfusionSec').value = '';
    document.getElementById('shotTimeSec').value = '';
    document.getElementById('tasteRating').value = '';
}

// ==========================================
// 6. RANGE SELECTOR MODAL CONTROLLER
// ==========================================
function openRangeModal() {
    const modal = document.getElementById('rangeModal');
    if (modal) modal.style.display = 'flex';
}

function closeRangeModal() {
    const modal = document.getElementById('rangeModal');
    if (modal) modal.style.display = 'none';
}

function selectRange(rangeName) {
    const currentRangeEl = document.getElementById('currentSelectedRange');
    if (currentRangeEl) currentRangeEl.innerText = rangeName;

    document.querySelectorAll('.range-option-item').forEach(item => {
        item.classList.remove('active');
        if (item.innerText.includes(rangeName)) {
            item.classList.add('active');
        }
    });

    closeRangeModal();
    calculateGrind();
}

// ==========================================
// 7. EVENT LISTENERS & INITIALIZATION
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() - 7);
    const roastDateEl = document.getElementById('roastDate');
    if (roastDateEl && !roastDateEl.value) {
        roastDateEl.value = defaultDate.toISOString().split('T')[0];
    }

    const profileEl = document.getElementById('roastProfile');
    const dateEl = document.getElementById('roastDate');

    if (profileEl) {
        profileEl.addEventListener('change', calculateGrind);
        profileEl.addEventListener('input', calculateGrind);
    }
    if (dateEl) {
        dateEl.addEventListener('change', calculateGrind);
        dateEl.addEventListener('input', calculateGrind);
    }

    const saveBtn = document.getElementById('saveLogBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveLogToSupabase);
    }

    const updateGpsBtn = document.getElementById('updateGpsBtn');
    if (updateGpsBtn) {
        updateGpsBtn.addEventListener('click', fetchWeatherByLocation);
    }

    calculateGrind();
    fetchWeatherByLocation();
});
