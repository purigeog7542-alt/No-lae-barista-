// ==========================================
// 1. DATABASE & CONFIG (ฐานข้อมูลเครื่องบด)
// ==========================================
const GRINDERS_DATABASE = {
    "timemore_bricks_01s": {
        name: "Timemore Bricks 01S (Electric)",
        baseRanges: { light: 1.1, medium: 1.8, dark: 2.4 },
        workflow: "ใช้ RDT พรมน้ำลดไฟฟ้าสถิต และหมุน Fines Knocker หลังบดเสร็จ"
    },
    "timemore_sculptor_01s": {
        name: "Timemore Sculptor 01S",
        baseRanges: { light: 2.0, medium: 2.5, dark: 3.2 },
        workflow: "ปรับรอบ RPM ตามโปรไฟล์ และใช้ Rotary Knocker"
    },
    "mischief_m40": {
        name: "Mischief M40 (Red Click)",
        baseRanges: { light: 14, medium: 18, dark: 22 },
        workflow: "พรมน้ำ RDT ทุกครั้ง ควบคุมความเร็วรอบมือหมุนให้สม่ำเสมอ"
    }
};

// ==========================================
// 2. SUPABASE INITIALIZATION
// ==========================================
// TODO: แทนที่ด้วย URL และ Anon Key ของโปรเจกต์ Supabase คุณ
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

let supabaseClient = null;
if (window.supabase && SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ==========================================
// 3. WEATHER & GPS AUTO-FETCH (สภาพอากาศบ้านนอแล)
// ==========================================
async function fetchWeatherByLocation() {
    const statusEl = document.getElementById('locationStatus');
    const tempValEl = document.getElementById('tempVal');
    const humValEl = document.getElementById('humVal');

    if (!navigator.geolocation) {
        statusEl.innerText = "⚠️ Browser ไม่รองรับ Geolocation ใช้ค่ามาตรฐานฐานปฏิบัติการ";
        return;
    }

    statusEl.innerText = "📍 กำลังดึงพิกัด GPS พื้นที่บ้านนอแล...";

    navigator.geolocation.getCurrentPosition(async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        statusEl.innerText = `✅ พิกัด: ${lat.toFixed(4)}, ${lon.toFixed(4)} (กำลังดึงสภาพอากาศ...)`;

        try {
            // ดึงข้อมูลอากาศจาก Open-Meteo API (ฟรี ไม่ต้องใช้ Key)
            const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m`);
            const data = await res.json();
            
            if (data && data.current) {
                const temp = data.current.temperature_2m;
                const hum = data.current.relative_humidity_2m;

                tempValEl.innerText = `${temp} °C`;
                humValEl.innerText = `${hum} %`;
                statusEl.innerText = `✅ อัปเดตสภาพอากาศจากพิกัดจริงสำเร็จ`;
                calculateGrind(); // คำนวณเบอร์บดใหม่ตามอุณหภูมิ/ความชื้นจริง
            }
        } catch (err) {
            console.error(err);
            statusEl.innerText = "⚠️ ดึงอากาศไม่สำเร็จ ใช้ค่าเริ่มต้นฐานปฏิบัติการ";
        }
    }, (error) => {
        console.warn(error);
        statusEl.innerText = "⚠️ ไม่สามารถเข้าถึง GPS ได้ ใช้ค่าอุณหภูมิมาตรฐาน 16.5°C";
    }, { timeout: 10000 });
}

// ==========================================
// 4. GRIND CALCULATION ENGINE (คำนวณเบอร์บดอัจฉริยะ)
// ==========================================
function calculateGrind() {
    const roastProfile = document.getElementById('roastProfile').value;
    const roastDateVal = document.getElementById('roastDate').value;
    
    // ดึงค่าพื้นฐานตามระดับการคั่ว
    let baseGrind = 1.8;
    if (roastProfile === 'light') baseGrind = 1.1;
    if (roastProfile === 'dark') baseGrind = 2.4;

    // คำนวณอายุเมล็ดกาแฟ (Degassing Effect)
    let ageDays = 7; // ค่าเริ่มต้น
    if (roastDateVal) {
        const roastDate = new Date(roastDateVal);
        const today = new Date();
        const diffTime = today - roastDate;
        ageDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }

    let ageAdjustment = 0;
    let alertMsg = "";

    if (ageDays < 5) {
        // เมล็ดสดเกินไป แก๊สเยอะ ต้องบดหยาบขึ้นป้องกัน Channelling
        ageAdjustment = +0.2;
        alertMsg = `⚠️ เมล็ดคั่วใหม่ (${ageDays} วัน) แก๊สยังคายไม่หมด แนะนำพักเมล็ดเพิ่มหรือบดหยาบขึ้น`;
    } else if (ageDays > 30) {
        // เมล็ดเก่า คายแก๊สหมด ต้องบดละเอียดขึ้นเพื่อเพิ่มแรงต้าน
        ageAdjustment = -0.15;
        alertMsg = `ℹ️ เมล็ดคั่วมาแล้ว ${ageDays} วัน (เริ่มเก่า) ชดเชยโดยการปรับเบอร์บดละเอียดขึ้น`;
    } else {
        alertMsg = `✨ เมล็ดอยู่ในช่วงเวลาสกัดที่เหมาะสม (${ageDays} วันหลังคั่ว)`;
    }

    const finalGrind = Math.max(0.5, baseGrind + ageAdjustment).toFixed(2);

    // แสดงผลบนหน้าจอ
    document.getElementById('recommendGrind').innerText = finalGrind;
    document.getElementById('adjustReason').innerText = `อิงตามคั่ว ${roastProfile} และอายุเมล็ด ${ageDays} วัน`;
    document.getElementById('extraAlert').innerText = alertMsg;
}

// ==========================================
// 5. SUPABASE LOG STORAGE (บันทึกผลลงฐานข้อมูล)
// ==========================================
async function saveLogToSupabase() {
    if (!supabaseClient) {
        alert('⚠️ ยังไม่ได้ตั้งค่าเชื่อมต่อ Supabase (โปรดใส่ URL และ Anon Key ใน app.js)');
        return;
    }

    const logData = {
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
        const { data, error } = await supabaseClient
            .from('brew_logs')
            .insert([logData]);

        if (error) throw error;

        alert('✅ บันทึกผลการสกัดลงฐานข้อมูล Supabase สำเร็จ!');
        // เคลียร์ฟอร์มผลสกัดจริง
        document.getElementById('actualYieldG').value = '';
        document.getElementById('preInfusionSec').value = '';
        document.getElementById('shotTimeSec').value = '';
        document.getElementById('tasteRating').value = '';
    } catch (err) {
        console.error(err);
        alert('❌ บันทึกไม่สำเร็จ: ' + err.message);
    }
}

// โหลดระบบอัตโนมัติเมื่อเปิดหน้าเว็บ
window.addEventListener('DOMContentLoaded', () => {
    // ตั้งค่าวันที่คั่วเริ่มต้นเป็น 7 วันที่แล้ว
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() - 7);
    document.getElementById('roastDate').value = defaultDate.toISOString().split('T')[0];

    // คำนวณเบอร์บดเริ่มต้น
    calculateGrind();

    // ดึงพิกัดอากาศอัตโนมัติ
    fetchWeatherByLocation();
});
