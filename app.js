// ==========================================
// 1. TIMEMORE BRICKS 01S ENGINE & DATABASE
// ==========================================
const BRICKS_CONFIG = {
    name: "Timemore Bricks 01S (40mm S2C040 Conical)",
    baseEspressoClick: 25, // ค่าเริ่มต้นมาตรฐานสำหรับเอสเพรสโซ
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
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1bnZqbGxramJlaml5Y2JjZ3h3Iiwicm9sZSI6InB1bnZqbGxramJlaml5Y2JjZ3h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQwNjIwNjcsImV4cCI6MjEwOTYzODA2N30.Sn8yDLnO2yn9kFhh9ftHsb_SfWZNr4GKLfOb56dlzn4';

let supabaseClient = null;
if (window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ==========================================
// 3. WEATHER & GPS (พร้อมพิกัดสำรองบ้านนอแล ไม่ให้ค้าง)
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
                // อัปเดตการคำนวณเบอร์บดใหม่ทันทีเมื่อได้อากาศสดๆ
                calculateGrind();
            }
        } catch (err) {
            console.error("Weather fetch error:", err);
            if (statusEl) statusEl.innerText = "⚠️ โหลดสภาพอากาศสำรองสำเร็จ";
        }
    };

    if (statusEl) statusEl.innerText = "📍 กำลังเชื่อมต่อสภาพอากาศบ้านนอแล...";

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                fetchWeatherAPI(position.coords.latitude, position.coords.longitude, "GPS มือถือ");
            }, 
            (error) => {
                console.warn("GPS bypass:", error);
                fetchWeatherAPI(norLaeLat, norLaeLon, "ฐานปฏิบัติการบ้านนอแล");
            }, 
            { timeout: 3000, enableHighAccuracy: false, maximumAge: 60000 }
        );
    } else {
        fetchWeatherAPI(norLaeLat, norLaeLon, "ฐานปฏิบัติการบ้านนอแล");
    }
}

// ==========================================
// 4. DYNAMIC GRIND CALCULATION (เชื่อมโยง Select Range + สภาพอากาศ + วันคั่ว)
// ==========================================
function calculateGrind() {
    const roastProfileEl = document.getElementById('roastProfile');
    const roastDateEl = document.getElementById('roastDate');
    const tempValEl = document.getElementById('tempVal');
    const humValEl = document.getElementById('humVal');
    const currentRangeEl = document.getElementById('currentSelectedRange');

    const roastProfile = roastProfileEl ? roastProfileEl.value : 'medium';
    const roastDateVal = roastDateEl ? roastDateEl.value : '';
    const selectedRange = currentRangeEl ? currentRangeEl.innerText : 'Medium-fine';
    
    const currentTemp = tempValEl ? parseFloat(tempValEl.innerText) || 25 : 25;
    const currentHum = humValEl ? parseFloat(humValEl.innerText) || 60 : 60;

    // 1. คำนวณค่าฐานจาก Range ที่ผู้ใช้เลือกในเมนู Pro
    let baseClick = 20; 
    if (selectedRange === 'Extra-fine') baseClick = 5;
    else if (selectedRange === 'Fine') baseClick = 12;
    else if (selectedRange === 'Medium-fine') baseClick = 20; // โซนมาตรฐาน Espresso
    else if (selectedRange === 'Medium') baseClick = 35;
    else if (selectedRange === 'Medium-coarse') baseClick = 60;
    else if (selectedRange === 'Coarse') baseClick = 90;

    let roastNote = "คั่วกลาง (Medium Roast)";
    if (roastProfile === 'light') {
        baseClick -= 2; 
        roastNote = "คั่วอ่อน (Light Roast)";
    } else if (roastProfile === 'dark') {
        baseClick += 3; 
        roastNote = "คั่วเข้ม (Dark Roast)";
    }

    // 2. คำนวณอายุเมล็ดกาแฟ
    let ageDays = 7;
    if (roastDateVal) {
        const roastDate = new Date(roastDateVal);
        const today = new Date();
        ageDays = Math.floor((today - roastDate) / (1000 * 60 * 60 * 24));
        if (isNaN(ageDays) || ageDays < 0) ageDays = 7;
    }

    // 3. ชดเชยตามสภาพอากาศ
    let weatherEffectNote = "";
    if (currentTemp > 28) {
        baseClick += 0.5;
        weatherEffectNote += "🌡️ อากาศร้อน ปรับหยาบขึ้นเล็กน้อย | ";
    } else if (currentTemp < 20) {
        baseClick -= 0.5;
        weatherEffectNote += "❄️ อากาศเย็น ปรับละเอียดขึ้นเล็กน้อย | ";
    }

    if (currentHum > 80) {
        baseClick += 0.5;
        weatherEffectNote += "💧 ความชื้นสูง ป้องกันก้อนแฟบจับตัว";
    }

    let alertMsg = `✨ เมล็ดอยู่ในช่วงเวลาสกัดที่เหมาะสม (${ageDays} วันหลังคั่ว)`;
    let warningExtra = "";

    // 4. ชดเชยตามอายุเมล็ดกาแฟ (Degassing Effect)
    if (ageDays < 5) {
        baseClick += 2;
        alertMsg = `⚠️ เมล็ดคั่วใหม่ (${ageDays} วัน) แก๊สยังเยอะ ควรบดหยาบขึ้น`;
    } else if (ageDays > 30) {
        baseClick = Math.max(1, baseClick - 2);
        alertMsg = `ℹ️ เมล็ดคั่วมาแล้ว ${ageDays} วัน เริ่มเก่า ชดเชยโดยปรับละเอียดขึ้น`;
    }

    if (roastProfile === 'light') {
        warningExtra = "คำเตือน: Bricks 01S เฟือง Conical อาจมีแรงบดไม่พอสำหรับคั่วอ่อนมากๆ ในระดับ Espresso";
    }

    let finalSettingClick = Math.max(1, Math.round(baseClick));

    // แสดงผลบนหน้าเว็บ
    const grindNumEl = document.getElementById('recommendGrind');
    const adjustReasonEl = document.getElementById('adjustReason');
    const extraAlertEl = document.getElementById('extraAlert');

    if (grindNumEl) grindNumEl.innerText = finalSettingClick;
    if (adjustReasonEl) {
        adjustReasonEl.innerText = `ช่วง: ${selectedRange} | ${roastNote}, อายุเมล็ด ${ageDays} วัน\nอากาศ: ${currentTemp}°C / ${currentHum}%`;
    }

    let workflowHtml = BRICKS_CONFIG.workflow.map(w => `<div>• ${w}</div>`).join('');

    if (extraAlertEl) {
        extraAlertEl.innerHTML = `
            <div>${alertMsg}</div>
            ${weatherEffectNote ? `<div style="color: #38bdf8; font-size: 0.75rem; margin-top: 2px;">${weatherEffectNote}</div>` : ''}
            ${warningExtra ? `<div style="color: #ef4444; margin-top: 4px;">⚠️ ${warningExtra}</div>` : ''}
            <div style="margin-top: 8px; font-size: 0.72rem; text-align: left; background: rgba(0,0,0,0.3); padding: 8px; border-radius: 6px; border: 1px solid #333;">
                <div style="font-weight: bold; color: var(--accent); margin-bottom: 3px;">💡 Workflow แนะนำ:</div>
                ${workflowHtml}
            </div>
        `;
    }
}

// ==========================================
// 5. SUPABASE LOG STORAGE (บันทึกผลการชง)
// ==========================================
async function saveLogToSupabase() {
    if (!supabaseClient) {
        alert('⚠️ ระบบ Supabase Client ยังไม่พร้อมใช้งาน');
        return;
    }

    const logData = {
        grinder_model: "timemore_bricks_01s",
        bean_name: document.getElementById('beanName').value,
        roast_profile: document.getElementById('roastProfile').value,
        roast_date: document.getElementById('roastDate').value || null,
        dose_g: parseFloat(document.getElementById('doseG').value) || 0,
        target_yield_g: parseFloat(document.getElementById('targetYield').value) || 0,
        recommended_grind: parseFloat(document.getElementById('recommendGrind').innerText) || 0,
        actual_yield_g: parseFloat(document.getElementById('actualYieldG').value) || null,
        pre_infusion_sec: parseFloat(document.getElementById('preInfusionSec').value) || null,
        shot_time_sec: parseFloat(document.getElementById('shotTimeSec').value) || null,
        taste_rating: document.getElementById('tasteRating').value || null,
        ambient_temp: parseFloat(document.getElementById('tempVal').innerText) || null,
        ambient_humidity: parseFloat(document.getElementById('humVal').innerText) || null,
        created_at: new Date().toISOString()
    };

    try {
        const { error } = await supabaseClient.from('brew_logs').insert([logData]);
        if (error) throw error;
        alert('✅ บันทึกผลการสกัดลงฐานข้อมูล Supabase สำเร็จ!');
        
        document.getElementById('actualYieldG').value = '';
        document.getElementById('preInfusionSec').value = '';
        document.getElementById('shotTimeSec').value = '';
        document.getElementById('tasteRating').value = '';
    } catch (err) {
        console.error("Supabase insert error:", err);
        alert('❌ บันทึกไม่สำเร็จ: ' + err.message);
    }
}

// ==========================================
// 6. RANGE SELECTOR MODAL CONTROLLER (วางไว้นอก DOMContentLoaded เพื่อให้ HTML เรียกได้)
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

    // อัปเดตสถานะ Active ใน Modal
    document.querySelectorAll('.range-option-item').forEach(item => {
        item.classList.remove('active');
        if (item.innerText.includes(rangeName)) {
            item.classList.add('active');
        }
    });

    closeRangeModal();
    
    // สั่งคำนวณเบอร์บดใหม่ทันทีตาม Range ที่เปลี่ยนไป
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

    ['roastProfile', 'roastDate'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', calculateGrind);
            el.addEventListener('input', calculateGrind);
        }
    });

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
