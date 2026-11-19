import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createEmptyState, serializeToFirestorePayload } from './src/services/wellnessStore';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');
const rulesText = fs.readFileSync(rulesPath, 'utf8');
const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8'));

test('firestore.rules enforces global default-deny catch-all and strict owner-only access', () => {
  assert.match(rulesText, /rules_version\s*=\s*'2'/);
  assert.match(rulesText, /match\s+\/\{document=\*\*\}\s*\{\s*allow read, write: if false;/);
  assert.match(rulesText, /match\s+\/users\/\{userId\}\/wellness\/\{docId\}/);
  assert.match(rulesText, /allow list:\s*if false;/);
  assert.match(rulesText, /function isOwner\(userId\)\s*\{\s*return isSignedIn\(\) && request\.auth\.uid == userId;/);
  assert.match(rulesText, /docId == 'state'/);
});

test('firestore.rules enforces ID validation, immutable ownership/createdAt, and server timestamps', () => {
  assert.match(rulesText, /function isValidId\(id\)/);
  assert.match(rulesText, /incoming\(\)\.uid == existing\(\)\.uid/);
  assert.match(rulesText, /incoming\(\)\.createdAt == existing\(\)\.createdAt/);
  assert.match(rulesText, /incoming\(\)\.createdAt == request\.time/);
  assert.match(rulesText, /incoming\(\)\.updatedAt == request\.time/);
  assert.match(rulesText, /affectedKeys\(\)\.hasOnly\(/);
});

test('firestore.rules enforces strict key allowlists and bounded array sizes (Dirty Dozen)', () => {
  assert.match(rulesText, /data\.keys\(\)\.hasOnly\(/);
  assert.match(rulesText, /profile\.keys\(\)\.hasOnly\(/);
  assert.match(rulesText, /readiness\.keys\(\)\.hasOnly\(/);
  assert.match(rulesText, /isValidBoundedMapList\(data\.vitalsHistory,\s*50\)/);
  assert.match(rulesText, /isValidBoundedMapList\(data\.nutritionLogs,\s*100\)/);
  assert.match(rulesText, /isValidBoundedMapList\(data\.workoutSessions,\s*50\)/);
  assert.match(rulesText, /isValidBoundedMapList\(data\.dailyHistory,\s*14\)/);
  assert.match(rulesText, /isValidBoundedMapList\(data\.tasks,\s*100\)/);
  assert.match(rulesText, /isValidBoundedMapList\(data\.wellnessLogs,\s*60\)/);
  assert.match(rulesText, /isValidStringList\(data\.dietAdherenceIds,\s*10\)/);
});

test('serialized Firestore payload strictly matches blueprint schema and firestore.rules bounds', () => {
  const today = '2026-11-19';
  const state = createEmptyState(today, 'Student Athlete');
  const payload = serializeToFirestorePayload('user_abc_123', 'student@campus.edu', state);

  const expectedKeys = Object.keys(blueprint.entities.WellnessState.properties).filter(
    (k) => k !== 'createdAt' && k !== 'updatedAt'
  );
  for (const key of Object.keys(payload)) {
    assert.ok(expectedKeys.includes(key), `Unexpected top-level key in payload: ${key}`);
  }
  assert.equal(payload.uid, 'user_abc_123');
  assert.match(payload.activeDateKey, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(payload.vitalsHistory.length <= 50);
  assert.ok(payload.nutritionLogs.length <= 100);
  assert.ok(payload.workoutSessions.length <= 50);
  assert.ok(payload.dailyHistory.length <= 14);
  assert.ok(payload.tasks.length <= 100);
  assert.ok(payload.wellnessLogs.length <= 60);
  assert.ok(payload.dietAdherenceIds.length <= 10);
});
