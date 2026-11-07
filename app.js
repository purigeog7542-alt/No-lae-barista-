// ==========================================
// IMPORT MODULES & DATABASES
// ==========================================
import { GRINDERS_DATABASE } from './grindersDatabase.js';
import { calculateGrindSetting } from './baristaLogicEngine.js';

// ==========================================
// SUPABASE CONFIGURATION
// ==========================================
const SUPABASE_URL = 'https://punvjllkjbeziycbcgxw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1bnZqbGxramJlaml5Y2JjZ3h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQwNjIwNjcsImV4cCI6MjEwOTYzODA2N30.Sn8yDLnO2yn9kFhh9ftHsb_SfWZNr4GKLfOb56dlzn4';

let supabaseClient = null;
if (window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ==========================================
// 1. WEATHER & GPS AUTO-FETCH (สภาพอากาศบ้านนอแล)
// ==========================================
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
            console.error("Weather fetch error:", err);
        }
    }, (error) => {
        console.warn("GPS error:", error);
        if (statusEl) statusEl.innerText = "⚠️ ไม่สามารถเข้าถึง GPS ได้ ใช้ค่ามาตรฐานฐานปฏิบัติการ";
    }, { timeout: 10000 });
}

// ==========================================
// 2. DYNAMIC GRIND CALCULATION ENGINE
// ==========================================
function calculateGrind() {
    const grinderId = document.getElementById('grinderSelect') ? document.getElementById('grinderSelect').value : 'timemore_bricks_01s';
    const roastProfile = document.getElementById('roastProfile').value; // light, medium, dark
    const roastDateVal = document.getElementById('roastDate').value;
    
    // คำนวณอายุเมล็ดกาแฟ
    let ageDays = 7;
    if (roastDateVal) {
        const roastDate = new Date(roastDateVal);
        const today = new Date();
        ageDays = Math.floor((today - roastDate) / (1000 * 60 * 60 * 24));
    }

    // กำหนดค่าตั้งต้นเบอร์บดตามระดับการคั่วเพื่อไม่ให้ค่าค้าง
    let baseClick = 25; // Medium
    if (roastProfile === 'light') {
        baseClick = 21; // คั่วอ่อน บดละเอียดขึ้น
    } else if (roastProfile === 'medium') {
        baseClick = 25; // คั่วกลาง
    } else if (roastProfile === 'dark') {
        baseClick = 30; // คั่วเข้ม บดหยาบขึ้น
    }

    // พยายามดึงค่าจาก Engine ภายนอก (ถ้ามี)
    let engineResult = null;
    try {
        engineResult = calculateGrindSetting({
            grinderId: grinderId,
            brewMethod: 'espresso',
            roastLevel: roastProfile,
            processType: 'washed'
        });
        if (engineResult && engineResult.finalSettingClick) {
            baseClick = engineResult.finalSettingClick;
        }
    } catch (e) {
        console.warn("Engine fallback used:", e);
    }

    let finalSetting = baseClick;
    let alertMsg = `✨ เมล็ดอยู่ในช่วงเวลาสกัดที่เหมาะสม (${ageDays} วันหลังคั่ว)`;

    // ปรับชดเชยตามอายุเมล็ดกาแฟ (Degassing Effect)
    if (ageDays < 5) {
        finalSetting += 3;
        alertMsg = `⚠️ เมล็ดคั่วใหม่ (${ageDays} วัน) แก๊สยังเยอะ ควรบดหยาบขึ้นป้องกัน Channelling`;
    } else if (ageDays > 30) {
        finalSetting = Math.max(1, finalSetting - 2);
        alertMsg = `ℹ️ เมล็ดคั่วมาแล้ว ${ageDays} วัน เริ่มเก่า ชดเชยโดยการปรับเบอร์บดละเอียดขึ้น`;
    }

    // แสดงผลบนหน้าเว็บ
    const grindNumEl = document.getElementById('recommendGrind');
    const adjustReasonEl = document.getElementById('adjustReason');
    const extraAlertEl = document.getElementById('extraAlert');

    if (grindNumEl) grindNumEl.innerText = finalSetting;
    if (adjustReasonEl) adjustReasonEl.innerText = `อิงตามคั่ว ${roastProfile} และอายุเมล็ด ${ageDays} วัน`;

    // ดึง Workflow และข้อควรระวังมาแสดงผล
    let workflowHtml = `
        <div>• ใช้ RDT สเปรย์พรมน้ำลดไฟฟ้าสถิตก่อนลง Hopper</div>
        <div>• หมุน Fines Knocker หลังบดเสร็จเพื่อเคลียร์ผงค้าง (~0.1-0.2g)</div>
    `;
    
    if (engineResult && engineResult.workflow && Array.isArray(engineResult.workflow)) {
        workflowHtml = engineResult.workflow.map(w => `<div>• ${w}</div>`).join('');
    }

    if (extraAlertEl) {
        extraAlertEl.innerHTML = `
            <div>${alertMsg}</div>
            ${engineResult && engineResult.warning ? `<div style="color: #ef4444; margin-top: 4px;">⚠️ ${engineResult.warning}</div>` : ''}
            <div style="margin-top: 8px; font-size: 0.72rem; text-align: left; background: rgba(0,0,0,0.15); padding: 8px; border-radius: 6px;">
                <div style="font-weight: bold; color: #f59e0b; margin-bottom: 3px;">💡 Workflow แนะนำ:</div>
                ${workflowHtml}
            </div>
        `;
    }
}

// ==========================================
// 3. SUPABASE LOG STORAGE (บันทึกผลการชง)
// ==========================================
async function saveLogToSupabase() {
    if (!supabaseClient) {
        alert('⚠️ ระบบ Supabase Client ยังไม่พร้อมใช้งาน');
        return;
    }

    const logData = {
        grinder_model: document.getElementById('grinderSelect') ? document.getElementById('grinderSelect').value : 'timemore_bricks_01s',
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
        
        // เคลียร์ฟอร์มผลสกัดจริงหลังบันทึก
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
// 4. EVENT LISTENERS & INITIALIZATION
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    // ตั้งค่าวันที่คั่วเริ่มต้นเป็น 7 วันที่แล้ว
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() - 7);
    const roastDateEl = document.getElementById('roastDate');
    if (roastDateEl) roastDateEl.value = defaultDate.toISOString().split('T')[0];

    // ผูก Event ให้ฟอร์มคำนวณอัตโนมัติเมื่อมีการเปลี่ยนแปลงค่า
    const triggerElements = ['grinderSelect', 'roastProfile', 'roastDate'];
    triggerElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', calculateGrind);
            el.addEventListener('input', calculateGrind); // รองรับการพิมพ์/กดเปลี่ยนค่าทันที
        }
    });

    // ผูกฟังก์ชันเข้ากับ Global window เพื่อให้ปุ่มใน HTML เรียกใช้งานได้ทันที
    window.fetchWeatherByLocation = fetchWeatherByLocation;
    window.saveLogToSupabase = saveLogToSupabase;
    window.calculateGrind = calculateGrind;

    // รันการคำนวณและดึงอากาศเมื่อเปิดหน้าเว็บ
    calculateGrind();
    fetchWeatherByLocation();
});
