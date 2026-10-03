import assert from "node:assert/strict";
import {test} from "node:test";
import {EQUIPMENT,DEFAULT_THRESHOLDS,parseTemperature,alarms,daysOfMonth,isClosed,todayParis,validateReading,csvForMonth,validWorkbookUrl} from "../lib/frigo.ts";

const sample=()=>({date:"2024-01-03",time:"09:15",initials:"AG",temperatures:Object.fromEntries(EQUIPMENT.map(e=>[e.id,e.max])),thresholds:{...DEFAULT_THRESHOLDS},note:"",exception:false,revision:0});
test("empty and malformed readings never become zero; French decimals and negatives are accepted",()=>{
  for(const value of [""," ","-","4x","1e2","Infinity","-90","61"])assert.equal(parseTemperature(value),null,value);
  assert.equal(parseTemperature("-18,4"),-18.4);assert.equal(parseTemperature("0"),0);assert.equal(parseTemperature("+3.5"),3.5);
  assert.equal(parseTemperature("4,04"),4.04);assert.equal(parseTemperature("-17,99"),-17.99);
});
test("a threshold is inclusive and only real exceedances trigger an alert",()=>{
  const record=sample();assert.equal(alarms(record).length,0);record.temperatures.cong_ch_1=-17.9;record.temperatures.arm_bar=4.1;assert.deepEqual(alarms(record).map(e=>e.id),["cong_ch_1","arm_bar"]);
});
test("dates use Paris, leap months work, and closure is Monday and Tuesday",()=>{
  assert.equal(todayParis(new Date("2026-09-01T22:30:00Z")),"2026-09-02");assert.equal(daysOfMonth("2024-02").length,29);assert.equal(daysOfMonth("2100-02").length,28);
  assert.equal(isClosed("2026-09-07"),true);assert.equal(isClosed("2026-09-08"),true);assert.equal(isClosed("2026-09-09"),false);
});
test("all equipment must be measured and closures need explicit exception",()=>{
  const record=sample();assert.equal(validateReading(record),null);delete record.temperatures.arm_bar;assert.match(validateReading(record),/13 équipements/);
  const closed={...sample(),date:"2024-01-02"};assert.match(validateReading(closed),/exceptionnel/);assert.equal(validateReading({...closed,exception:true}),null);
  assert.match(validateReading({...sample(),date:"2024-02-30"}),/date valide/);assert.match(validateReading({...sample(),time:"25:00"}),/heure/);
});
test("CSV keeps 18 columns, numeric negative temperatures, empty days, and neutralizes formula text",()=>{
  const record={...sample(),id:"test",createdAt:"",updatedAt:"",initials:"=HYPERLINK(1)",note:'=SUM(1;2) "test"'};
  const csv=csvForMonth("2024-01",[record]);assert.equal(csv.charCodeAt(0),0xfeff);assert.equal(csv.split("\r\n").length,32);
  assert.ok(csv.includes('"Date";"Heure";"Cong. ch. 1"'));assert.ok(csv.includes('; -18')===false);assert.ok(csv.includes(';-18;-18;-18;-18;4;'));
  assert.ok(csv.includes('"\'=HYPERLINK(1)"'));assert.ok(csv.includes('"\'=SUM(1;2) ""test"""'));assert.ok(csv.includes('"02/01/2024";"";;;;;;;;;;;;;;"";"";"Fermé"'));
});
test("only Microsoft workbook links are accepted",()=>{
  assert.equal(validWorkbookUrl("https://1drv.ms/x/example"),true);assert.equal(validWorkbookUrl("https://org.sharepoint.com/example.xlsx"),true);
  for(const u of ["javascript:alert(1)","https://onedrive.live.com.evil.test/file","http://1drv.ms/x/a","https://name:secret@1drv.ms/a"])assert.equal(validWorkbookUrl(u),false);
});
