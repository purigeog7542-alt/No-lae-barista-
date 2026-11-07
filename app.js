// ==========================================
// 1. GRINDERS DATABASE & LOGIC ENGINE (Built-in)
// ==========================================
const GRINDERS_DATABASE = {
  "timemore_bricks_01s": {
    id: "timemore_bricks_01s",
    name: "Timemore Bricks 01S",
    type: "Electric Single-Dose",
    burr: "40mm S2C040 Conical Burr (55-58 HRC)",
    totalClicks: 150,
    retention: "0.1 - 0.2g (Fines Knocker)",
    workflow: [
      "ใช้ RDT สเปรย์พรมน้ำ 1-2 ละอองบนเมล็ดกาแฟก่อนลง Hopper เพื่อลดไฟฟ้าสถิต",
      "กดปุ่มเปิดเครื่องก่อนค่อยเปิดฝาเทเมล็ดกาแฟลงไป",
      "เมื่อบดเสร็จ ให้หมุน Fines Knocker เพื่อเคาะผงกาแฟค้างช็อตให้ออกหมด"
    ],
    baseRanges: {
      espresso: { min: 1, max: 45, default: 25 },
      moka_pot: { min: 15, max: 60, default: 35 },
      pour_over: { min: 75, max: 120, default: 95 },
      french_press: { min: 127, max: 145, default: 135 }
    },
    limitations: {
      lightRoastEspresso: "คำเตือน: Bricks 01S ใช้เฟือง Conical S2C040 อาจมีแรงบดไม่พอสำหรับเมล็ดคั่วอ่อนมากในระดับ Espresso"
    }
  },
  "timemore_sculptor_01s": {
    id: "timemore_sculptor_01s",
    name: "Timemore Sculptor 01S",
    type: "Electric Flat Burr",
    baseRanges: {
      espresso: { min: 1, max: 5, default: 2 },
      pour_over: { min: 6, max: 12, default: 8 }
    },
    workflow: ["ปรับ RPM ตามโปรไฟล์รสชาติ", "ใช้ Rotary Knocker เคลียร์ผง"]
  },
  "mischief_m40": {
    id: "mischief_m40",
    name: "Mischief M40 (Red Click)",
    type: "Manual Hand Grinder",
    baseRanges: {
      espresso: { min: 10, max: 30, default: 18 },
      pour_over: { min: 40, max: 70, default: 55 }
    },
    workflow: ["ใช้ RDT พรมน้ำก่อนบด", "หมุนด้วยรอบคงที่"]
  }
};

function calculateGrindSetting({ grinderId, brewMethod, roastLevel = 'medium', processType = 'washed' }) {
  const grinder = GRINDERS_DATABASE[grinderId];
  if (!grinder) return { error: "ไม่พบข้อมูลเครื่องบดที่ระบุ" };

  const targetMethod = (brewMethod === 'cafelat_robot') ? 'espresso' : brewMethod;
  const base = grinder.baseRanges[targetMethod];
  if (!base) return { error: "เครื่องบดนี้ไม่รองรับการชงประเภทนี้" };

  let calculatedClick = base.default;
  let adjustmentNotes = [];

  if (grinderId === 'timemore_bricks_01s') {
    if (roastLevel === 'light') {
      calculatedClick -= 4;
      adjustmentNotes.push("คั่วอ่อน (Light Roast): ปรับละเอียดขึ้น 4 Clicks");
    } else if (roastLevel === 'medium_light') {
      calculatedClick -= 2;
    } else if (roastLevel === 'dark') {
      calculatedClick += 5;
      adjustmentNotes.push("คั่วเข้ม (Dark Roast): ปรับหยาบขึ้น 5 Clicks");
    }
  }

  let warningMessage = null;
  if (grinderId === 'timemore_bricks_01s' && targetMethod === 'espresso' && roastLevel === 'light') {
    warningMessage = grinder.limitations.lightRoastEspresso;
  }

  return {
    grinderName: grinder.name,
    targetMethod: brewMethod,
    finalSettingClick: Math.max(base.min, Math.min(base.max, calculatedClick)),
    recommendedRange: `${base.min} - ${base.max} Clicks`,
    workflow: grinder.workflow,
    adjustmentNotes: adjustmentNotes,
    warning: warningMessage
  };
}

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
// 3. WEATHER & GPS AUTO-FETCH (สภาพอากาศบ้านนอแล)
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
// 4. DYNAMIC GRIND CALCULATION ENGINE
// ==========================================
function calculateGrind() {
    const grinderSelectEl = document.getElementById('grinderSelect');
    const roastProfileEl = document.getElementById('roastProfile');
    const roastDateEl = document.getElementById('roastDate');

    const grinderId = grinderSelectEl ? grinderSelectEl.value : 'timemore_bricks_01s';
    const roastProfile = roastProfileEl ? roastProfileEl.value : 'medium';
    const roastDateVal = roastDateEl ? roastDateEl.value : '';
    
    let ageDays = 7;
    if (roastDateVal) {
        const roastDate = new Date(roastDateVal);
        const today = new Date();
        ageDays = Math.floor((today - roastDate) / (1000 * 60 * 60 * 24));
    }

    const result = calculateGrindSetting({
        grinderId: grinderId,
        brewMethod: 'espresso',
        roastLevel: roastProfile,
        processType: 'washed'
    });

    if (result.error) {
        console.error(result.error);
        return;
    }

    let finalSettingClick = result.finalSettingClick;
    let alertMsg = `✨ เมล็ดอยู่ในช่วงเวลาสกัดที่เหมาะสม (${ageDays} วันหลังคั่ว)`;

    if (ageDays < 5) {
        finalSettingClick += 3;
        alertMsg = `⚠️ เมล็ดคั่วใหม่ (${ageDays} วัน) แก๊สยังเยอะ ควรบดหยาบขึ้น`;
    } else if (ageDays > 30) {
        finalSettingClick = Math.max(1, finalSettingClick - 2);
        alertMsg = `ℹ️ เมล็ดคั่วมาแล้ว ${ageDays} วัน เริ่มเก่า ปรับเบอร์บดละเอียดขึ้น`;
    }

    const grindNumEl = document.getElementById('recommendGrind');
    const adjustReasonEl = document.getElementById('adjustReason');
    const extraAlertEl = document.getElementById('extraAlert');

    if (grindNumEl) grindNumEl.innerText = finalSettingClick;
    if (adjustReasonEl) adjustReasonEl.innerText = `อิงตามเครื่องบด ${result.grinderName}, คั่ว ${roastProfile} และอายุเมล็ด ${ageDays} วัน`;

    let workflowHtml = "";
    if (result.workflow && Array.isArray(result.workflow)) {
        workflowHtml = result.workflow.map(w => `<div>• ${w}</div>`).join('');
    }

    if (extraAlertEl) {
        extraAlertEl.innerHTML = `
            <div>${alertMsg}</div>
            ${result.warning ? `<div style="color: #ef4444; margin-top: 4px;">⚠️ ${result.warning}</div>` : ''}
            <div style="margin-top: 8px; font-size: 0.72rem; text-align: left; background: rgba(0,0,0,0.15); padding: 8px; border-radius: 6px;">
                <div style="font-weight: bold; color: #f59e0b; margin-bottom: 3px;">💡 Workflow แนะนำ:</div>
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
        grinder_model: document.getElementById('grinderSelect').value,
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

    ['grinderSelect', 'roastProfile', 'roastDate'].forEach(id => {
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
