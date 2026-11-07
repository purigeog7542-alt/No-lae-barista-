// app.js
import { GRINDERS_DATABASE } from './grindersDatabase.js';
import { calculateGrindSetting } from './baristaLogicEngine.js';

// TODO: ใส่ค่า Supabase ของคุณที่นี่
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

let supabaseClient = null;
if (window.supabase && SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ฟังก์ชันดึงสภาพอากาศจาก GPS ตามพิกัดจริง
async function fetchWeatherByLocation() {
    const statusEl = document.getElementById('locationStatus');
    const tempValEl = document.getElementById('tempVal');
    const humValEl = document.getElementById('humVal');

    if (!navigator.geolocation) {
        if (statusEl) statusEl.innerText = "⚠️ Browser ไม่รองรับ Geolocation";
        return;
    }

    if (statusEl) statusEl.innerText = "📍 กำลังดึงพิกัด GPS พื้นที่บ้านนอแล...";

    navigator.geolocation.getCurrentPosition(async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        if (statusEl) statusEl.innerText = `✅ พิกัด: ${lat.toFixed(4)}, ${lon.toFixed(4)}`;

        try {
            const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m`);
            const data = await res.json();
            
            if (data && data.current) {
                if (tempValEl) tempValEl.innerText = `${data.current.temperature_2m} °C`;
                if (humValEl) humValEl.innerText = `${data.current.relative_humidity_2m} %`;
            }
        } catch (err) {
            console.error(err);
        }
    }, (error) => {
        console.warn(error);
        if (statusEl) statusEl.innerText = "⚠️ ไม่สามารถเข้าถึง GPS ได้ ใช้ค่ามาตรฐาน";
    }, { timeout: 10000 });
}

// ฟังก์ชันคำนวณเบอร์บดหลัก
function calculateGrind() {
    const roastProfile = document.getElementById('roastProfile').value;
    const roastDateVal = document.getElementById('roastDate').value;
    
    // คำนวณอายุเมล็ดกาแฟ
    let ageDays = 7;
    if (roastDateVal) {
        const roastDate = new Date(roastDateVal);
        const today = new Date();
        ageDays = Math.floor((today - roastDate) / (1000 * 60 * 60 * 24));
    }

    // เรียกใช้ตรรกะจาก Engine หรือคำนวณเบื้องต้นตามสเปก Bricks 01S
    let baseGrind = roastProfile === 'light' ? 15 : (roastProfile === 'dark' ? 35 : 25);
    let alertMsg = `✨ เมล็ดอยู่ในช่วงเวลาสกัดที่เหมาะสม (${ageDays} วันหลังคั่ว)`;

    if (ageDays < 5) {
        baseGrind += 3;
        alertMsg = `⚠️ เมล็ดคั่วใหม่ (${ageDays} วัน) แก๊สยังเยอะ ควรบดหยาบขึ้น`;
    } else if (ageDays > 30) {
        baseGrind -= 2;
        alertMsg = `ℹ️ เมล็ดคั่วมาแล้ว ${ageDays} วัน เริ่มเก่า ควรบดละเอียดขึ้น`;
    }

    // แสดงผลบนหน้าเว็บ
    document.getElementById('recommendGrind').innerText = baseGrind;
    document.getElementById('adjustReason').innerText = `อิงตามคั่ว ${roastProfile} และอายุเมล็ด ${ageDays} วัน`;
    
    // แสดง Workflow และคำแนะนำเชิงลึกของเครื่องบด
    document.getElementById('extraAlert').innerHTML = `
        ${alertMsg}
        <div style="margin-top: 8px; font-size: 0.72rem; text-align: left; background: rgba(0,0,0,0.15); padding: 8px; border-radius: 6px;">
            <div style="font-weight: bold; color: #f59e0b; margin-bottom: 3px;">💡 Workflow แนะนำ (Timemore Bricks 01S):</div>
            <div>• พรมน้ำ RDT ก่อนเทเมล็ดลง Hopper เพื่อลดไฟฟ้าสถิต</div>
            <div>• หลังบดเสร็จ ให้หมุน Fines Knocker เพื่อเคาะผงค้าง (~0.1-0.2g)</div>
        </div>
    `;
}

// ฟังก์ชันบันทึกข้อมูลลง Supabase
async function saveLogToSupabase() {
    if (!supabaseClient) {
        alert('⚠️ กรุณาตั้งค่า Supabase URL และ Anon Key ใน app.js ก่อนบันทึก');
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
        created_at: new Date().toISOString()
    };

    try {
        const { error } = await supabaseClient.from('brew_logs').insert([logData]);
        if (error) throw error;
        alert('✅ บันทึกผลการสกัดลง Supabase สำเร็จ!');
    } catch (err) {
        console.error(err);
        alert('❌ บันทึกไม่สำเร็จ: ' + err.message);
    }
}

// ผูก Event เมื่อโหลดหน้าเว็บเสร็จ
window.addEventListener('DOMContentLoaded', () => {
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() - 7);
    document.getElementById('roastDate').value = defaultDate.toISOString().split('T')[0];

    // ผูก Event ให้ฟอร์มคำนวณอัตโนมัติเมื่อมีการเปลี่ยนแปลง
    document.getElementById('roastProfile').addEventListener('change', calculateGrind);
    document.getElementById('roastDate').addEventListener('change', calculateGrind);
    
    // ผูกปุ่มบันทึก (ให้แน่ใจว่าปุ่มใน HTML มี onclick หรือเพิ่ม Event Listener ที่นี่)
    window.saveLogToSupabase = saveLogToSupabase;
    window.fetchWeatherByLocation = fetchWeatherByLocation;

    calculateGrind();
    fetchWeatherByLocation();
});
