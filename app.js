// ==========================================
// DYNAMIC GRIND CALCULATION (Timemore Bricks 01S - 150 Clicks Scale)
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

    // 1. กำหนดค่าฐานตามช่วง Select Range บนสเกล 150 คลิกของ Bricks 01S
    // Espresso: 1-45 | Moka: 15-60 | Pour Over: 75-120 | French Press: 127-145
    let baseClick = 20; // ค่าเริ่มต้นโซน Medium-fine (Espresso ทั่วไป)
    
    if (selectedRange === 'Extra-fine') baseClick = 5;       // โซนละเอียดพิเศษ (Turkish / Very Fine Espresso)
    else if (selectedRange === 'Fine') baseClick = 12;      // โซน Fine สำหรับ Espresso ช็อตแน่น
    else if (selectedRange === 'Medium-fine') baseClick = 22; // โซน Espresso มาตรฐาน (1-45 คลิก)[cite: 13, 14]
    else if (selectedRange === 'Medium') baseClick = 38;      // โซน Moka Pot / Espresso หยาบ (15-60 คลิก)[cite: 13, 14]
    else if (selectedRange === 'Medium-coarse') baseClick = 85; // โซน Pour Over / Drip V60 (75-120 คลิก)[cite: 13, 14]
    else if (selectedRange === 'Coarse') baseClick = 135;     // โซน French Press (127-145 คลิก)[cite: 13, 14]

    let roastNote = "คั่วกลาง (Medium Roast)";
    if (roastProfile === 'light') {
        baseClick -= 3; // คั่วอ่อน เมล็ดแน่น บดละเอียดขึ้น
        roastNote = "คั่วอ่อน (Light Roast)";
    } else if (roastProfile === 'dark') {
        baseClick += 4; // คั่วเข้ม บดหยาบขึ้นป้องกันขมไหม้
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

    // 3. ชดเชยตามสภาพอากาศ (อุณหภูมิและความชื้น)
    let weatherEffectNote = "";
    if (currentTemp > 28) {
        baseClick += 1;
        weatherEffectNote += "🌡️ อากาศร้อน เมล็ดคลายตัวไว ปรับหยาบขึ้น 1 คลิก | ";
    } else if (currentTemp < 20) {
        baseClick -= 1;
        weatherEffectNote += "❄️ อากาศเย็น เมล็ดแน่นขึ้น ปรับละเอียดขึ้น 1 คลิก | ";
    }

    if (currentHum > 80) {
        baseClick += 1;
        weatherEffectNote += "💧 ความชื้นสูง ป้องกันก้อนแฟบจับตัว";
    }

    let alertMsg = `✨ เมล็ดอยู่ในช่วงเวลาสกัดที่เหมาะสม (${ageDays} วันหลังคั่ว)`;
    let warningExtra = "";

    // 4. ชดเชยตามอายุเมล็ดกาแฟ (Degassing Effect)
    if (ageDays < 5) {
        baseClick += 3; // เมล็ดใหม่แก๊สเยอะ เพิ่มคลิกให้หยาบขึ้น
        alertMsg = `⚠️ เมล็ดคั่วใหม่ (${ageDays} วัน) แก๊สยังเยอะ ควรบดหยาบขึ้น 3 คลิก`;
    } else if (ageDays > 30) {
        baseClick = Math.max(1, baseClick - 2); // เมล็ดเก่าลดคลิกให้ละเอียดขึ้น
        alertMsg = `ℹ️ เมล็ดคั่วมาแล้ว ${ageDays} วัน เริ่มเก่า ปรับละเอียดขึ้น 2 คลิก`;
    }

    if (roastProfile === 'light' && selectedRange.includes('fine')) {
        warningExtra = "คำเตือน: Bricks 01S เฟือง Conical อาจมีแรงบดไม่พอสำหรับคั่วอ่อนมากๆ ในระดับ Espresso[cite: 6, 11]";
    }

    // จำกัดช่วงคลิกให้อยู่ในสเกล 1 - 145 ของเครื่อง
    let finalSettingClick = Math.min(145, Math.max(1, Math.round(baseClick)));

    // แสดงผลบนหน้าเว็บ
    const grindNumEl = document.getElementById('recommendGrind');
    const adjustReasonEl = document.getElementById('adjustReason');
    const extraAlertEl = document.getElementById('extraAlert');

    if (grindNumEl) grindNumEl.innerText = `${finalSettingClick} คลิก`;
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
