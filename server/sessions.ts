import { and, desc, eq } from "drizzle-orm";
import { sessionRegistrations } from "../drizzle/schema";
import { getDb } from "./db";
import { parseEventDate } from "./eventTime";
export function sessionKeyFor(date: string | null | undefined): string | null {
 const d=parseEventDate(date); if(!d) return null;
 const key=`${d.year}-${String(d.month+1).padStart(2,"0")}-${String(d.day).padStart(2,"0")}`;
 return key==="2026-10-20"?null:key;
}
export async function createSessionRegistration(input:{sessionKey:string;firstName:string;lastName:string;email:string;track:string|null}) {
 const db=await getDb();if(!db) throw Error("Database unavailable");
 const email=input.email.trim().toLowerCase();
 await db.insert(sessionRegistrations).values({...input,email})
 .onConflictDoUpdate({target:[sessionRegistrations.sessionKey,sessionRegistrations.email],
 set:{firstName:input.firstName.trim(),lastName:input.lastName.trim(),track:input.track}});
 const rows=await db.select().from(sessionRegistrations).where(and(eq(sessionRegistrations.sessionKey,input.sessionKey),eq(sessionRegistrations.email,email))).limit(1);
 return rows[0];
}
export async function confirmSessionRegistration(sessionKey:string,email:string) {
 const db=await getDb();if(!db)return {row:undefined,alreadyConfirmed:false};
 const where=and(eq(sessionRegistrations.sessionKey,sessionKey),eq(sessionRegistrations.email,email.trim().toLowerCase()));
 const [row]=await db.select().from(sessionRegistrations).where(where).limit(1);
 if(!row)return {row:undefined,alreadyConfirmed:false};
 if(row.confirmedAt)return {row,alreadyConfirmed:true};
 const confirmedAt=new Date();await db.update(sessionRegistrations).set({confirmedAt}).where(where);
 return {row:{...row,confirmedAt},alreadyConfirmed:false};
}
export async function listSessionRegistrations(sessionKey:string) {
 const db=await getDb();if(!db)return [];
 return db.select().from(sessionRegistrations).where(eq(sessionRegistrations.sessionKey,sessionKey)).orderBy(desc(sessionRegistrations.createdAt));
}
export async function setSessionAttendance(sessionKey:string,email:string,attended:boolean) {
 const db=await getDb();if(!db)return {row:undefined,alreadyAttended:false};
 const where=and(eq(sessionRegistrations.sessionKey,sessionKey),eq(sessionRegistrations.email,email.trim().toLowerCase()));
 const [row]=await db.select().from(sessionRegistrations).where(where).limit(1);
 if(!row)return {row:undefined,alreadyAttended:false};
 const alreadyAttended=!!row.attendedAt;
 if(attended&&!alreadyAttended)await db.update(sessionRegistrations).set({attendedAt:new Date()}).where(where);
 if(!attended&&alreadyAttended)await db.update(sessionRegistrations).set({attendedAt:null}).where(where);
 return {row,alreadyAttended};
}
export async function unsubscribeSessions(email:string) {
 const db=await getDb();if(!db)return;
 await db.update(sessionRegistrations).set({unsubscribedAt:new Date()})
 .where(eq(sessionRegistrations.email,email.trim().toLowerCase()));
}
export async function isSessionUnsubscribed(email:string) {
 const db=await getDb();if(!db)return false;
 const rows=await db.select({unsubscribedAt:sessionRegistrations.unsubscribedAt}).from(sessionRegistrations).where(eq(sessionRegistrations.email,email.trim().toLowerCase()));
 return rows.some(r=>!!r.unsubscribedAt);
}
