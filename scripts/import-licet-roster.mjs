import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";

const db = new PrismaClient();
const demoNames = ["Ananya Rao", "Rohan Patel", "Ishita Nair", "Arjun Singh", "Meera Iyer", "Kabir Shah", "Diya Menon", "Aditya Verma"];
const roster = JSON.parse(readFileSync(".local-data/licet-roster.json", "utf8"));
assert.equal(roster.length, 67);
const records = roster.map(([rollNumber, name]) => ({
  rollNumber,
  name,
  email: `${name.split(/\s+/).filter(part => part.length > 1).join("").toLowerCase()}.28it@licet.ac.in`,
  department: "Information Technology",
  semester: 5,
}));
assert.equal(new Set(records.map(r => r.rollNumber)).size, 67);
assert.equal(new Set(records.map(r => r.email)).size, 67);

try {
  const collisions = await db.student.count({ where: { rollNumber: { in: records.map(r => r.rollNumber) } } });
  assert.equal(collisions, 0, "Roster already exists, or conflicts with existing students. No changes made.");
  assert.equal(await db.user.count({where:{email:{in:records.map(r=>r.email)}}}), 0, "Email collision. No changes made.");
  const seed = await db.auditLog.findFirstOrThrow({where:{action:"DEVELOPMENT_SEED"},orderBy:{createdAt:"asc"}});
  const demoRolls = demoNames.map((_, i) => `ST2026${String(i + 1).padStart(3, "0")}`);
  const demo = await db.student.findMany({where:{rollNumber:{in:demoRolls}},include:{user:true,loans:{include:{fine:{include:{settlements:true}}}},requests:true}});
  assert.equal(demo.length, 8, "Expected exactly eight original demo students.");
  for (const student of demo) {
    const index = demoRolls.indexOf(student.rollNumber);
    assert.equal(student.user.name, demoNames[index], "Demo profile has been changed; manual review is needed.");
    assert.equal(student.user.email, index === 0 ? "student@folio.local" : `${demoNames[index].toLowerCase().replace(" ", ".")}@folio.local`);
    assert(student.createdAt <= seed.createdAt);
    for (const loan of student.loans) {
      assert(loan.issuedAt <= seed.createdAt && (!loan.returnedAt || loan.returnedAt <= seed.createdAt), "A demo student has newer borrowing activity; review before replacement.");
      for (const settlement of loan.fine?.settlements ?? []) assert(settlement.reference?.startsWith("DEMO-"), "A non-demo settlement must not be removed.");
    }
    assert(student.requests.every(r => r.createdAt <= seed.createdAt && r.updatedAt <= seed.createdAt), "A demo request has been modified.");
  }
  const studentIds = demo.map(s=>s.id), userIds = demo.map(s=>s.userId), loans = demo.flatMap(s=>s.loans), loanIds = loans.map(l=>l.id), requestIds = demo.flatMap(s=>s.requests.map(r=>r.id));
  const newerActivity = await db.auditLog.count({where:{createdAt:{gt:seed.createdAt},OR:[{userId:{in:userIds}},{recordId:{in:[...studentIds,...userIds,...loanIds,...requestIds]}}]}});
  assert.equal(newerActivity, 0, "Demo records have been used after seeding. Manual review is needed.");
  const admin = await db.user.findFirstOrThrow({where:{role:"ADMIN",active:true}});
  mkdirSync(".local-data", {recursive:true});
  const stamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
  const backup = `.local-data/before-student-replacement-${stamp}.dump`;
  const connection = new URL(process.env.DATABASE_URL);
  execFileSync("C:/Program Files/PostgreSQL/18/bin/pg_dump.exe", ["-h",connection.hostname,"-p",connection.port || "5432","-U",decodeURIComponent(connection.username),"-d",connection.pathname.slice(1),"-Fc","-f",backup], {env:{...process.env,PGPASSWORD:decodeURIComponent(connection.password)},stdio:"pipe"});
  const credentials = [];
  for (const record of records) {
    const password = randomBytes(15).toString("base64url");
    credentials.push({...record,password,passwordHash:await hash(password,12)});
  }
  const pending = `.local-data/licet-student-logins-${stamp}.pending.txt`;
  const final = `.local-data/licet-student-logins-${stamp}.txt`;
  writeFileSync(pending, "LICET — Information Technology — Semester 5\nPrivate account credentials. Email addresses were generated from the supplied naming convention.\n\n" + credentials.map(r=>`${r.rollNumber} | ${r.name}\nEmail: ${r.email}\nPassword: ${r.password}\n`).join("\n"),{flag:"wx",mode:0o600});
  await db.$transaction(async tx => {
    const currentActivity = await tx.auditLog.count({where:{createdAt:{gt:seed.createdAt},OR:[{userId:{in:userIds}},{recordId:{in:[...studentIds,...userIds,...loanIds,...requestIds]}}]}});
    assert.equal(currentActivity,0,"Records changed during preparation. No changes committed.");
    await tx.settlement.deleteMany({where:{fine:{loanId:{in:loanIds}}}});
    await tx.fine.deleteMany({where:{loanId:{in:loanIds}}});
    await tx.loan.deleteMany({where:{id:{in:loanIds}}});
    await tx.bookCopy.updateMany({where:{id:{in:loans.filter(l=>!l.returnedAt).map(l=>l.copyId)}},data:{status:"AVAILABLE"}});
    await tx.bookRequest.deleteMany({where:{id:{in:requestIds}}});
    await tx.auditLog.deleteMany({where:{OR:[{userId:{in:userIds}},{recordId:{in:[...studentIds,...userIds,...loanIds,...requestIds]}}]}});
    await tx.student.deleteMany({where:{id:{in:studentIds}}});
    await tx.user.deleteMany({where:{id:{in:userIds}}});
    for(const {name,email,passwordHash,rollNumber,department,semester} of credentials) {
      await tx.student.create({data:{rollNumber,department,semester,user:{create:{name,email,passwordHash,role:"STUDENT",active:true}}}});
    }
    await tx.auditLog.create({data:{userId:admin.id,action:"STUDENT_ROSTER_REPLACED",recordId:"licet-it-2024",detail:`User-requested replacement: removed 8 untouched demo students and their sample transactions; imported 67 Information Technology students, semester 5. Backup retained locally.`}});
    await tx.notification.create({data:{userId:admin.id,message:"Imported 67 LICET Information Technology students (semester 5), replacing the demonstration students."}});
  },{isolationLevel:"Serializable",timeout:30000});
  renameSync(pending,final);
  console.log(JSON.stringify({imported:67,removedDemoStudents:8,removedDemoLoans:loanIds.length,removedDemoRequests:requestIds.length,credentialsFile:final,backupFile:backup}));
} finally { await db.$disconnect(); }
