const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { setGlobalOptions } = require('firebase-functions/v2');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();
const db = admin.firestore();
setGlobalOptions({ region: 'europe-west2', memory: '256MiB', timeoutSeconds: 30, maxInstances: 2, minInstances: 0 });
const gmailUser = defineSecret('GMAIL_USER');
const gmailAppPassword = defineSecret('GMAIL_APP_PASSWORD');

class Guard {
  static auth(request) { if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in is required.'); return request.auth; }
  static text(value, name, max = 120) { const v = String(value || '').trim(); if (!v || v.length > max) throw new HttpsError('invalid-argument', `${name} is invalid.`); return v; }
}
class AuditLog {
  static write(action, actorId, data = {}) { return db.collection('auditLogs').add({ action, actorId, data, createdAt: admin.firestore.FieldValue.serverTimestamp() }); }
}
class GroupService {
  static async create(uid, data) {
    const ref = db.collection('groups').doc();
    const group = { name: Guard.text(data.name, 'Group name'), type: Guard.text(data.type || 'Other', 'Group type'), accentColor: /^#[0-9a-f]{6}$/i.test(data.accentColor || '') ? data.accentColor : '#2dd4bf', ownerId: uid, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    const membership = { userId: uid, groupId: ref.id, role: 'groupLeader', sectionId: null, partId: null, status: 'active', joinedAt: admin.firestore.FieldValue.serverTimestamp() };
    const batch = db.batch();
    batch.set(ref, group);
    batch.set(ref.collection('members').doc(uid), membership);
    batch.set(db.collection('memberships').doc(`${ref.id}_${uid}`), membership);
    await batch.commit();
    await AuditLog.write('group.created', uid, { groupId: ref.id });
    return { groupId: ref.id };
  }
}
class InviteService {
  static code() { return `TACET-${Math.random().toString(36).slice(2, 6).toUpperCase()}`; }
  static async create(uid, data) {
    const groupId = Guard.text(data.groupId, 'Group', 80);
    const member = await db.doc(`groups/${groupId}/members/${uid}`).get();
    if (!member.exists || !['groupLeader', 'sectionLeader'].includes(member.data().role)) throw new HttpsError('permission-denied', 'You cannot create invites for this group.');
    const code = this.code();
    await db.collection('invites').doc(code).set({ code, groupId, createdBy: uid, active: true, createdAt: admin.firestore.FieldValue.serverTimestamp(), expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 30 * 86400000) });
    return { code, url: `https://band-diary.web.app/?join=${code}` };
  }
  static async redeem(uid, data) {
    const code = Guard.text(data.code, 'Invite code', 40).toUpperCase();
    const ref = db.collection('invites').doc(code);
    const invite = await ref.get();
    if (!invite.exists || !invite.data().active || invite.data().expiresAt.toMillis() < Date.now()) throw new HttpsError('not-found', 'That invite is invalid or expired.');
    const groupId = invite.data().groupId;
    const membership = { userId: uid, groupId, role: 'member', sectionId: null, partId: null, status: 'active', joinedAt: admin.firestore.FieldValue.serverTimestamp() };
    const batch = db.batch();
    batch.set(db.doc(`groups/${groupId}/members/${uid}`), membership);
    batch.set(db.doc(`memberships/${groupId}_${uid}`), membership);
    await batch.commit();
    await AuditLog.write('invite.redeemed', uid, { groupId, code });
    return { groupId };
  }
}
class MailService {
  static transporter(user, password) { return nodemailer.createTransport({ service: 'gmail', auth: { user, pass: password } }); }
  static async send(user, password, { to, subject, html }) { if (!to?.length) return; return this.transporter(user, password).sendMail({ from: `Tacet <${user}>`, to: to.join(','), subject, html }); }
}

exports.createGroup = onCall({ maxInstances: 1 }, r => GroupService.create(Guard.auth(r).uid, r.data));
exports.createInvite = onCall({ maxInstances: 1 }, r => InviteService.create(Guard.auth(r).uid, r.data));
exports.redeemInvite = onCall({ maxInstances: 2 }, r => InviteService.redeem(Guard.auth(r).uid, r.data));
exports.processScheduledReports = onSchedule({ schedule: 'every 60 minutes', timeZone: 'Europe/London', secrets: [gmailUser, gmailAppPassword], maxInstances: 1, timeoutSeconds: 120 }, async () => {
  const now = new Date();
  const hour = now.getUTCHours();
  const groups = await db.collection('groups').where('emailSettings.enabled', '==', true).where('emailSettings.hourUtc', '==', hour).limit(100).get();
  for (const groupDoc of groups.docs) {
    const g = groupDoc.data();
    const jobId = `${groupDoc.id}_${now.toISOString().slice(0, 10)}_${hour}`;
    const jobRef = db.collection('emailJobs').doc(jobId);
    if ((await jobRef.get()).exists) continue;
    await jobRef.create({ status: 'processing', createdAt: admin.firestore.FieldValue.serverTimestamp() });
    try {
      await MailService.send(gmailUser.value(), gmailAppPassword.value(), {
        to: g.emailSettings.recipients || [],
        subject: `${g.name} attendance summary`,
        html: `<div style="font-family:Arial;background:#0f172a;color:#f1f5f9;padding:28px;border-radius:16px"><h1 style="color:#2dd4bf">Tacet</h1><h2>${g.name}</h2><p>Your scheduled attendance summary is ready. Open Tacet for the latest section breakdown.</p></div>`
      });
      await jobRef.update({ status: 'sent', sentAt: admin.firestore.FieldValue.serverTimestamp() });
    } catch (error) {
      await jobRef.update({ status: 'failed', error: String(error.message).slice(0, 500) });
    }
  }
});
