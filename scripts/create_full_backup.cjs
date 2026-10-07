const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\ferit\\.gemini\\antigravity-ide\\brain\\900c8a96-db1c-4e2c-b886-b558428e5ff2';

function extractData(content) {
  let text = content;
  try {
    const parsed = JSON.parse(content);
    if (parsed.result) text = parsed.result;
  } catch (e) {}
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('Could not find JSON array in content');
  const jsonStr = text.substring(start, end + 1);
  return JSON.parse(jsonStr);
}

// 1. Teachers
// From step 309 output in transcript/tool response:
const teachers = [
  {"id":"d4594022-b78b-4e11-a27f-be84f50e06bd","name":"BURÇİN GÜNDÜZ","username":"BURCİNA","password":"$2a$06$GwewR1f2/YpwBpjWasbdK.zCI4RwAi3CdYKkzq9ol7KNgWJRuieCy","created_by_admin_id":"47495c08-8515-4e1f-a94a-1ae4ae14c56a","created_at":"2026-08-21T08:47:04.996301+00:00"},
  {"id":"5387c3c9-201a-488a-b914-b0c34e4a3355","name":"ZEYNEP AKÇIL","username":"ZEYNEPA","password":"$2a$06$1VFyKphz1iby3x9HquT/UOWLSm3NFhOnbIFEvQEHpD7eMoRZ2bST2","created_by_admin_id":"47495c08-8515-4e1f-a94a-1ae4ae14c56a","created_at":"2026-08-21T09:04:20.905711+00:00"},
  {"id":"99fea900-23fa-4a81-b699-28228f9227bf","name":"FİDEL COŞKUN","username":"FİDELA","password":"$2a$06$wxVtMI7aU.oruiFkoxyLoePpIIoNBhSPAGx98KaamhFZmVKBmgiFS","created_by_admin_id":"47495c08-8515-4e1f-a94a-1ae4ae14c56a","created_at":"2026-08-21T09:04:58.505194+00:00"},
  {"id":"ec2d3e9d-94e9-4a18-92a2-bf985f3fd341","name":"EYLEM GÜRSOY","username":"EYLEMB","password":"$2a$06$rRwcNSSGjosoZb02SjDJPeylUXfRatpu9CE/aM5a5/NJeZezT0lc6","created_by_admin_id":"47495c08-8515-4e1f-a94a-1ae4ae14c56a","created_at":"2026-08-21T09:05:21.607827+00:00"},
  {"id":"793fd3e5-0a5c-449d-97b4-02dbceab067f","name":"SEÇİL SARI","username":"SEÇİLB","password":"$2a$06$Xx77wj/Pj260u2iZJDazY.5XbSQ0yjpkesuK9vT7t50kFgc.NbznC","created_by_admin_id":"47495c08-8515-4e1f-a94a-1ae4ae14c56a","created_at":"2026-08-21T09:05:46.553754+00:00"},
  {"id":"960d91ba-e0dc-438a-9ac2-56d6bef2eb2b","name":"NURTEN KİREZCİ","username":"NURTENE","password":"$2a$06$c6fJLDHiONQ3vGvas0v5XO5wQr5t6yzVy0h5SmhNHKewzD7E0CBMm","created_by_admin_id":"47495c08-8515-4e1f-a94a-1ae4ae14c56a","created_at":"2026-08-21T09:07:16.209872+00:00"},
  {"id":"e5c6e18f-8adf-4949-b88d-7ecca7a99c6e","name":"GAMZE MANALP","username":"GAMZEE","password":"$2a$06$scokKEXfbvJmDTOX.cocV.ylhXgDN2qkmGpRs0BWQ5UrK8wHG/YhC","created_by_admin_id":"47495c08-8515-4e1f-a94a-1ae4ae14c56a","created_at":"2026-08-21T09:08:06.311545+00:00"},
  {"id":"2ec74868-dac0-47be-ab67-69ebb3aff7f4","name":"MİNE KÖYMEN","username":"MİNED","password":"$2a$06$eHOY1za.GHu/3lW73nZaSuqvdmHsVJHACvREqRhB8jgxEM96aVhV6","created_by_admin_id":"47495c08-8515-4e1f-a94a-1ae4ae14c56a","created_at":"2026-08-21T09:06:34.111779+00:00"},
  {"id":"f442864c-6051-4d33-b185-f98ac61da872","name":"BUĞRA AKTAŞ","username":"BUĞRAC","password":"$2a$06$A1k6uZCxLEV19xYWhQybW.YYZ4Z7nMzgUZYUsM8l1hlRnI6o.JKu6","created_by_admin_id":"47495c08-8515-4e1f-a94a-1ae4ae14c56a","created_at":"2026-08-21T09:05:10.625276+00:00"},
  {"id":"0efc091b-d580-40d0-a8fe-d4fc07b2fdab","name":"Meryem Uluca","username":"meryemd","password":"$2a$06$ZMDuTFyq0xKGmKLwQjG/0edsKEYuQA8LoLeot8oOjhkEF3ZQTGQ4m","created_by_admin_id":"47495c08-8515-4e1f-a94a-1ae4ae14c56a","created_at":"2026-10-05T06:55:14.233778+00:00"},
  {"id":"787a202d-7689-4605-bb66-895436e37fba","name":"MELİSA KASAP","username":"MELİSAC","password":"$2a$06$xaabxrJ1GPSG1v.DYErgb.dU1y/dhr5ransr7/EFCLCl3KSjc3oLG","created_by_admin_id":"47495c08-8515-4e1f-a94a-1ae4ae14c56a","created_at":"2026-08-21T09:10:44.218556+00:00"}
];

// 2. Students (step 311)
const step311Raw = fs.readFileSync(path.join(brainDir, '.system_generated', 'steps', '311', 'output.txt'), 'utf-8');
const students = extractData(step311Raw)[0].students;

// 3. Entries (step 313)
const step313Raw = fs.readFileSync(path.join(brainDir, '.system_generated', 'steps', '313', 'output.txt'), 'utf-8');
const entries = extractData(step313Raw)[0].entries;

// 4. Denemeler, Guidance Notes, Counselors, Admins (step 315)
const step315Raw = fs.readFileSync(path.join(brainDir, '.system_generated', 'steps', '315', 'output.txt'), 'utf-8');
const step315Data = extractData(step315Raw)[0];
const denemeler = step315Data.denemeler || [];
const guidance_notes = step315Data.guidance_notes || [];
const counselors = step315Data.counselors || [];
const admins = step315Data.admins || [];

// 5. Weekly plans, Logins (step 317)
const step317Raw = fs.readFileSync(path.join(brainDir, '.system_generated', 'steps', '317', 'output.txt'), 'utf-8');
const step317Data = extractData(step317Raw)[0];
const weekly_plans = step317Data.weekly_plans || [];
const teacher_logins = step317Data.teacher_logins || [];
const student_logins = step317Data.student_logins || [];

console.log('✅ Parsed Counts:');
console.log('Teachers:', teachers.length);
console.log('Students:', students.length);
console.log('Entries:', entries.length);
console.log('Denemeler:', denemeler.length);
console.log('Guidance notes:', guidance_notes.length);
console.log('Counselors:', counselors.length);
console.log('Admins:', admins.length);
console.log('Weekly plans:', weekly_plans.length);
console.log('Teacher logins:', teacher_logins.length);
console.log('Student logins:', student_logins.length);

const fullBackup = {
  metadata: {
    backup_date: new Date().toISOString(),
    total_teachers: teachers.length,
    total_students: students.length,
    total_entries: entries.length,
    total_denemeler: denemeler.length,
    total_guidance_notes: guidance_notes.length,
    total_counselors: counselors.length,
    total_admins: admins.length
  },
  admins,
  counselors,
  teachers,
  students,
  entries,
  denemeler,
  guidance_notes,
  weekly_plans,
  teacher_logins,
  student_logins
};

// Write JSON backup
const backupsDir = path.resolve(__dirname, '..', 'backups');
if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

const jsonPath = path.join(backupsDir, 'db_backup_full_2026-10-07.json');
fs.writeFileSync(jsonPath, JSON.stringify(fullBackup, null, 2), 'utf-8');
console.log('💾 JSON backup written to:', jsonPath);

// Generate SQL restore script
function sqlVal(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val;
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

function generateTableInserts(tableName, rows) {
  if (!rows || rows.length === 0) return `-- No rows in ${tableName}\n`;
  const cols = Object.keys(rows[0]);
  let sql = `-- Table: ${tableName} (${rows.length} rows)\n`;
  for (const r of rows) {
    const vals = cols.map(c => sqlVal(r[c])).join(', ');
    sql += `INSERT INTO public.${tableName} (${cols.join(', ')}) VALUES (${vals}) ON CONFLICT DO NOTHING;\n`;
  }
  return sql + '\n';
}

let sqlScript = `-- ========================================================\n`;
sqlScript += `-- LGS Soru Takip - Tam Veritabanı Yedeği (${new Date().toISOString()})\n`;
sqlScript += `-- Bu dosya tüm öğretmen, öğrenci, soru ve deneme kayıtlarını içerir.\n`;
sqlScript += `-- ========================================================\n\n`;

sqlScript += generateTableInserts('admins', admins);
sqlScript += generateTableInserts('counselors', counselors);
sqlScript += generateTableInserts('teachers', teachers);
sqlScript += generateTableInserts('students', students);
sqlScript += generateTableInserts('entries', entries);
sqlScript += generateTableInserts('denemeler', denemeler);
sqlScript += generateTableInserts('guidance_notes', guidance_notes);
sqlScript += generateTableInserts('weekly_plans', weekly_plans);

const sqlPath = path.join(backupsDir, 'db_backup_full_2026-10-07.sql');
fs.writeFileSync(sqlPath, sqlScript, 'utf-8');
console.log('💾 SQL backup written to:', sqlPath);

// Also copy to PC Desktop: C:\Users\ferit\OneDrive\Desktop\LGS_YEDEK_2026-10-07
const desktopBackupDir = 'C:\\Users\\ferit\\OneDrive\\Desktop\\LGS_YEDEK_2026-10-07';
if (!fs.existsSync(desktopBackupDir)) fs.mkdirSync(desktopBackupDir, { recursive: true });

fs.copyFileSync(jsonPath, path.join(desktopBackupDir, 'db_backup_full_2026-10-07.json'));
fs.copyFileSync(sqlPath, path.join(desktopBackupDir, 'db_backup_full_2026-10-07.sql'));

// Copy latest excel as well if exists
const excelName = 'lgs-haftalik-yedek-2026-10-05-ila-2026-10-11.xlsx';
const excelSrc = path.join(backupsDir, excelName);
if (fs.existsSync(excelSrc)) {
  fs.copyFileSync(excelSrc, path.join(desktopBackupDir, excelName));
  console.log('💾 Excel backup copied to Desktop!');
}

console.log('🎉 Desktop Backup completed in:', desktopBackupDir);
