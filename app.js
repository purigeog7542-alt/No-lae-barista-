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
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1bnZqbGxramJlaml5Y2JjZ3h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQwNjIwNjcsImV4cCI6MjEwOTYzODA2N30.Sn8yDLnO2yn9kFhh9ftHsb_SfWZNr4GKLfOb56dlzn4';

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
// 4. DYNAMIC GRIND CALCULATION (Timemore Bricks 01S)
// ==========================================
function calculateGrind() {
    const roastProfileEl = document.getElementById('roastProfile');
    const roastDateEl = document.getElementById('roastDate');

    const roastProfile = roastProfileEl ? roastProfileEl.value : 'medium';
    const roastDateVal = roastDateEl ? roastDateEl.value : '';
    
    // คำนวณอายุเมล็ดกาแฟ
    let ageDays = 7;
    if (roastDateVal) {
        const roastDate = new Date(roastDateVal);
        const today = new Date();
        ageDays = Math.floor((today - roastDate) / (1000 * 60 * 60 * 24));
    }

    // คำนวณเบอร์บดตามระดับการคั่วสำหรับ Timemore Bricks 01S
    let finalSettingClick = BRICKS_CONFIG.baseEspressoClick;
    let roastNote = "คั่วกลาง (Medium Roast)";

    if (roastProfile === 'light') {
        finalSettingClick -= 4; // คั่วอ่อน บดละเอียดขึ้น
        roastNote = "คั่วอ่อน (Light Roast)";
    } else if (roastProfile === 'dark') {
        finalSettingClick += 5; // คั่วเข้ม บดหยาบขึ้น
        roastNote = "คั่วเข้ม (Dark Roast)";
    }

    let alertMsg = `✨ เมล็ดอยู่ในช่วงเวลาสกัดที่เหมาะสม (${ageDays} วันหลังคั่ว)`;
    let warningExtra = "";

    // ปรับชดเชยตามอายุเมล็ดกาแฟ (Degassing Effect)
    if (ageDays < 5) {
        finalSettingClick += 3;
        alertMsg = `⚠️ เมล็ดคั่วใหม่ (${ageDays} วัน) แก๊สยังเยอะ ควรบดหยาบขึ้นป้องกัน Channelling`;
    } else if (ageDays > 30) {
        finalSettingClick = Math.max(1, finalSettingClick - 2);
        alertMsg = `ℹ️ เมล็ดคั่วมาแล้ว ${ageDays} วัน เริ่มเก่า ชดเชยโดยการปรับเบอร์บดละเอียดขึ้น`;
    }

    if (roastProfile === 'light') {
        warningExtra = "คำเตือน: Bricks 01S เฟือง Conical อาจมีแรงบดไม่พอสำหรับคั่วอ่อนมากๆ ในระดับ Espresso";
    }

    // แสดงผลบนหน้าเว็บ
    const grindNumEl = document.getElementById('recommendGrind');
    const adjustReasonEl = document.getElementById('adjustReason');
    const extraAlertEl = document.getElementById('extraAlert');

    if (grindNumEl) grindNumEl.innerText = finalSettingClick;
    if (adjustReasonEl) adjustReasonEl.innerText = `อิงตามเครื่องบด ${BRICKS_CONFIG.name}, ${roastNote} และอายุเมล็ด ${ageDays} วัน`;

    let workflowHtml = BRICKS_CONFIG.workflow.map(w => `<div>• ${w}</div>`).join('');

    if (extraAlertEl) {
        extraAlertEl.innerHTML = `
            <div>${alertMsg}</div>
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
// 6. EVENT LISTENERS & INITIALIZATION
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
