// baristaLogicEngine.js
import { GRINDERS_DATABASE } from './grindersDatabase.js';

/**
 * คำนวณเบอร์บดกาแฟที่แม่นยำที่สุดสำหรับ บาริสต้า
 * @param {Object} params
 * @param {string} params.grinderId - ID เครื่องบด
 * @param {string} params.brewMethod - espresso | pour_over | moka_pot | french_press | cafelat_robot
 * @param {string} params.roastLevel - light | medium_light | medium | dark
 * @param {string} params.processType - washed | natural | anaerobic
 */
export function calculateGrindSetting({ grinderId, brewMethod, roastLevel = 'medium', processType = 'washed' }) {
  const grinder = GRINDERS_DATABASE[grinderId];
  if (!grinder) return { error: "ไม่พบข้อมูลเครื่องบดที่ระบุ" };

  // Map Cafelat Robot เป็นประเภท Espresso
  const targetMethod = (brewMethod === 'cafelat_robot') ? 'espresso' : brewMethod;
  const base = grinder.baseRanges[targetMethod];

  if (!base) return { error: "เครื่องบดนี้ไม่รองรับการชงประเภทนี้" };

  let calculatedClick = base.default;
  let adjustmentNotes = [];

  // 1. ปรับตามระดับการคั่ว (Roast Level Adjustment)
  // เมล็ดคั่วอ่อนหดตัวสูง/ความหนาแน่นสูง -> ต้องบดละเอียดขึ้น (ลบนับคลิก)
  // เมล็ดคั่วเข้มเปราะร่ารวดเร็ว -> ต้องบดหยาบขึ้น (บวกนับคลิก)
  if (grinderId === 'timemore_bricks_01s') {
    if (roastLevel === 'light') {
      calculatedClick -= 4;
      adjustmentNotes.push("คั่วอ่อน (Light Roast): ปรับละเอียดขึ้น 4 Clicks เพิ่มการสกัดสารกาแฟ");
    } else if (roastLevel === 'medium_light') {
      calculatedClick -= 2;
      adjustmentNotes.push("คั่วกลางอ่อน (Medium-Light Roast): ปรับละเอียดขึ้น 2 Clicks");
    } else if (roastLevel === 'dark') {
      calculatedClick += 5;
      adjustmentNotes.push("คั่วเข้ม (Dark Roast): ปรับหยาบขึ้น 5 Clicks เพื่อลดความขมจัด (Over-extraction)");
    }
  } else if (grinderId === 'mischief_m40_red_click') {
    if (roastLevel === 'light') calculatedClick -= 3;
    if (roastLevel === 'dark') calculatedClick += 4;
  }

  // 2. ปรับตาม Process ของเมล็ดกาแฟ
  if (processType === 'natural' || processType === 'anaerobic') {
    calculatedClick += (grinderId === 'timemore_bricks_01s' ? 2 : 1);
    adjustmentNotes.push("Natural/Anaerobic Process: ปรับหยาบขึ้นเล็กน้อย ป้องกันผงละเอียด (Fines) ตันอัตราการไหล");
  }

  // 3. ตรวจสอบเงื่อนไขพิเศษสำหรับเครื่องชง Cafelat Robot
  if (brewMethod === 'cafelat_robot') {
    adjustmentNotes.push("🤖 สำหรับ Cafelat Robot: เน้น Pre-infusion 5-8 วินาที แรงดัน 2-3 บาร์ ก่อนกด 6-8 บาร์");
  }

  // 4. ตรวจสอบ Warning ข้อจำกัดของเครื่องบด
  let warningMessage = null;
  if (grinderId === 'timemore_bricks_01s' && targetMethod === 'espresso' && roastLevel === 'light') {
    warningMessage = grinder.limitations.lightRoastEspresso; //[span_16](start_span)[span_16](end_span)[span_17](start_span)[span_17](end_span)
  }

  return {
    grinderName: grinder.name,
    targetMethod: brewMethod,
    finalSettingClick: Math.max(base.min, Math.min(base.max, calculatedClick)),
    recommendedRange: `${base.min} - ${base.max} Clicks`, //[span_18](start_span)[span_18](end_span)
    workflow: grinder.workflow,
    adjustmentNotes: adjustmentNotes,
    warning: warningMessage
  };
}
