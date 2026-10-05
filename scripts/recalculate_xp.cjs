const fs = require('fs');
const path = require('path');

// Resolve pg from SpeakMateAI-Frontend or Admin_Frontend node_modules
function resolvePg() {
  const candidates = [
    path.resolve(__dirname, '../SpeakMateAI-Frontend/node_modules/pg'),
    path.resolve(__dirname, '../Admin_Frontend/node_modules/pg'),
    path.resolve(__dirname, '../SpeakMate AI/node_modules/pg'),
    'pg'
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (e) {}
  }
  throw new Error("Could not locate 'pg' module in any frontend node_modules folder.");
}
const { Client } = resolvePg();

// Safely load .env if present
function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}
loadEnv();

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const connectionArg = args.find(a => !a.startsWith('--'));
const connectionString = connectionArg || process.env.DATABASE_URL || process.env.SPRING_DATASOURCE_URL;

if (!connectionString) {
  console.error("❌ Error: No database URL provided.");
  console.error("Usage: node scripts/recalculate_xp.cjs \"postgresql://user:pass@host/dbname?sslmode=require\" [--dry-run]");
  process.exit(1);
}

function sanitizeUrlForLog(url) {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = '******';
    return parsed.toString();
  } catch {
    return 'PostgreSQL database';
  }
}

async function runRecalculation() {
  console.log("==================================================");
  console.log("SPEAKMATE AI - DATABASE USER PROGRESS RECALCULATION");
  console.log("Target Database:", sanitizeUrlForLog(connectionString));
  console.log("Mode:", isDryRun ? "DRY-RUN (Simulating changes, no writes)" : "LIVE EXECUTION (Updating database)");
  console.log("==================================================");

  const client = new Client({ connectionString });
  await client.connect();

  try {
    // 1. Fetch all users
    const usersRes = await client.query("SELECT id, first_name, last_name, email FROM users ORDER BY id ASC");
    const users = usersRes.rows;
    console.log(`Found ${users.length} users to process.\n`);

    let totalUpdated = 0;

    for (const u of users) {
      const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email;

      // Completed speaking sessions count, duration, and xp
      const speakingRes = await client.query(
        "SELECT count(*)::int as count, COALESCE(SUM(duration), 0)::int as duration, COALESCE(SUM(xp_earned), 0)::int as xp FROM speaking_sessions WHERE user_id = $1 AND completed = true",
        [u.id]
      );
      const completedSpeakingCount = speakingRes.rows[0].count;
      const speakingDurationSeconds = speakingRes.rows[0].duration;
      let speakingXp = speakingRes.rows[0].xp;
      // Fallback: If completed sessions had 0 xp_earned, credit baseline 15 per completed session
      if (speakingXp === 0 && completedSpeakingCount > 0) {
        speakingXp = completedSpeakingCount * 15;
      }
      const speakingMinutes = Math.ceil(speakingDurationSeconds / 60);

      // Completed lessons count, minutes, and xp
      let lessonCount = 0;
      let lessonMinutes = 0;
      let lessonXp = 0;
      try {
        const lessonRes = await client.query(
          "SELECT count(*)::int as count, COALESCE(SUM(time_spent_minutes), 0)::int as minutes, COALESCE(SUM(xp_earned), 0)::int as xp FROM lesson_progress WHERE user_id = $1 AND (completed = true OR progress_percent = 100)",
          [u.id]
        );
        lessonCount = lessonRes.rows[0].count;
        lessonMinutes = lessonRes.rows[0].minutes;
        lessonXp = lessonRes.rows[0].xp;
      } catch (err) {
        // Table or columns may not exist or empty
      }

      // Vocabulary and grammar counts
      let vocabCount = 0;
      try {
        const vRes = await client.query("SELECT count(*)::int as count FROM vocabulary WHERE user_id = $1", [u.id]);
        vocabCount = vRes.rows[0].count;
      } catch (err) {}

      let grammarCount = 0;
      try {
        const gRes = await client.query("SELECT count(*)::int as count FROM grammar_history WHERE user_id = $1", [u.id]);
        grammarCount = gRes.rows[0].count;
      } catch (err) {}

      // Distinct scenarios completed
      let distinctScenarios = 0;
      try {
        const distRes = await client.query(
          "SELECT count(DISTINCT LOWER(TRIM(COALESCE(NULLIF(scenario, ''), topic))))::int as count FROM speaking_sessions WHERE user_id = $1 AND completed = true",
          [u.id]
        );
        distinctScenarios = distRes.rows[0].count;
      } catch (err) {}

      // User streaks
      let currentStreak = 0;
      let longestStreak = 0;
      try {
        const strRes = await client.query("SELECT current_streak, longest_streak FROM progress WHERE user_id = $1", [u.id]);
        if (strRes.rows.length > 0) {
          currentStreak = strRes.rows[0].current_streak || 0;
          longestStreak = strRes.rows[0].longest_streak || 0;
        }
      } catch (err) {}
      const streakVal = Math.max(currentStreak, longestStreak);

      // Re-evaluate achievements
      let achievementXp = 0;
      try {
        const achRes = await client.query("SELECT id, title, unlocked, xp_reward FROM achievement WHERE user_id = $1", [u.id]);
        for (const a of achRes.rows) {
          if (a.unlocked) {
            let relock = false;
            // Speaking
            if (a.title === 'First Voice Conversation' && completedSpeakingCount < 1) relock = true;
            if (a.title === 'Confident Conversationalist' && distinctScenarios < 5) relock = true;
            if (a.title === 'Fluency Champion' && completedSpeakingCount < 15) relock = true;
            if (a.title === 'Orator Supreme' && completedSpeakingCount < 30) relock = true;

            // Grammar
            if (a.title === 'Grammar Inspector' && grammarCount < 1) relock = true;
            if (a.title === 'Syntax Detective' && grammarCount < 10) relock = true;
            if (a.title === 'Tense Master' && grammarCount < 25) relock = true;
            if (a.title === 'Grammar Scholar' && grammarCount < 50) relock = true;

            // Vocabulary
            if (a.title === 'Word Collector' && vocabCount < 5) relock = true;
            if (a.title === 'Lexicon Expander' && vocabCount < 20) relock = true;
            if (a.title === 'Vocabulary Maestro' && vocabCount < 50) relock = true;

            // Streaks
            if (a.title === '3-Day Habit Starter' && streakVal < 3) relock = true;
            if (a.title === '7-Day Week Warrior' && streakVal < 7) relock = true;
            if (a.title === '14-Day Dedication' && streakVal < 14) relock = true;
            if (a.title === '30-Day Legend' && streakVal < 30) relock = true;

            // Mastery
            const potentialXp = speakingXp + lessonXp + (vocabCount * 5) + (grammarCount * 5) + achievementXp + (a.xp_reward || 50);
            if (a.title === 'XP Explorer' && potentialXp < 250) relock = true;
            if (a.title === 'Level 5 Achiever') {
              if (Math.max(1, Math.floor(potentialXp / 500) + 1) < 5 && potentialXp < 2000) relock = true;
            }
            if (a.title === 'Mastery Grandmaster' && potentialXp < 2000) relock = true;

            if (relock) {
              console.log(`  [Relocking] Achievement "${a.title}" for ${fullName} (conditions not met)`);
              if (!isDryRun) {
                await client.query("UPDATE achievement SET unlocked = false, unlocked_at = NULL WHERE id = $1", [a.id]);
              }
            } else {
              achievementXp += (a.xp_reward || 50);
            }
          }
        }
      } catch (err) {}

      // Total legitimate XP calculation
      const vocabXp = vocabCount * 5;
      const grammarXp = grammarCount * 5;
      const totalLegitimateXp = speakingXp + lessonXp + achievementXp + vocabXp + grammarXp;
      const totalPracticeMinutes = speakingMinutes + lessonMinutes;
      const calculatedLevel = Math.max(1, Math.floor(totalLegitimateXp / 500) + 1);

      // Current progress in DB
      const progRes = await client.query("SELECT * FROM progress WHERE user_id = $1", [u.id]);
      if (progRes.rows.length === 0) {
        // Create if missing
        if (!isDryRun) {
          await client.query(
            "INSERT INTO progress (user_id, xp, level, total_speaking_sessions, total_practice_minutes, total_vocabulary_words, total_grammar_checks, current_streak, longest_streak) VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 0)",
            [u.id, totalLegitimateXp, calculatedLevel, completedSpeakingCount, totalPracticeMinutes, vocabCount, grammarCount]
          );
        }
        console.log(`[Created] Progress record for ${fullName} with ${totalLegitimateXp} XP (Level ${calculatedLevel}, ${completedSpeakingCount} completed sessions)`);
        totalUpdated++;
      } else {
        const cur = progRes.rows[0];
        const oldSessions = cur.total_speaking_sessions != null ? cur.total_speaking_sessions : 0;
        const oldXp = cur.xp != null ? cur.xp : 0;
        const oldLevel = cur.level != null ? cur.level : 1;

        const isChanged = (oldSessions !== completedSpeakingCount) || (oldXp !== totalLegitimateXp);

        if (isChanged) {
          totalUpdated++;
          console.log(`[Updating] User ${u.id} (${fullName}):`);
          console.log(`   - Speaking Sessions: ${oldSessions} -> ${completedSpeakingCount}`);
          console.log(`   - Total XP: ${oldXp} -> ${totalLegitimateXp}`);
          console.log(`   - Level: ${oldLevel} -> ${calculatedLevel}`);
          console.log(`   - Practice Minutes: ${cur.total_practice_minutes || 0} -> ${totalPracticeMinutes}`);

          if (!isDryRun) {
            await client.query(
              "UPDATE progress SET xp = $1, level = $2, total_speaking_sessions = $3, total_practice_minutes = $4, total_vocabulary_words = $5, total_grammar_checks = $6 WHERE user_id = $7",
              [totalLegitimateXp, calculatedLevel, completedSpeakingCount, totalPracticeMinutes, vocabCount, grammarCount, u.id]
            );
          }
        }
      }
    }

    console.log("\n==================================================");
    console.log(`SUMMARY: Processed ${users.length} users. ${totalUpdated} user progress records updated.`);
    if (isDryRun) {
      console.log("NOTE: This was a dry-run. Run without '--dry-run' to write changes.");
    } else {
      console.log("✅ All user progress and XP successfully synchronized with verified completed activities.");
    }
    console.log("==================================================");

  } finally {
    await client.end();
  }
}

runRecalculation().catch(err => {
  console.error("❌ Recalculation failed:", err);
  process.exit(1);
});
