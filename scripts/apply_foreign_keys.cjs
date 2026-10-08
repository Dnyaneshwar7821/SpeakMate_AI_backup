const fs = require('fs');
const path = require('path');

function resolvePg() {
  const candidates = [
    path.resolve(__dirname, '../SpeakMateAI-Frontend/node_modules/pg'),
    path.resolve(__dirname, '../Admin_Frontend/node_modules/pg'),
    'pg'
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (e) {}
  }
  throw new Error("Could not locate 'pg' module.");
}
const { Client } = resolvePg();

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

const connStr = process.argv[2] || process.env.DATABASE_URL;
if (!connStr) {
  console.error("❌ Error: DATABASE_URL not found in arguments or .env");
  process.exit(1);
}
const targetConnStr = connStr.replace('-pooler', '');

const foreignKeys = [
  {
    "constraint_name": "fksqca9anleo0k3oe1k2n3yj3ur",
    "source_table": "achievement",
    "target_table": "users",
    "constraint_def": "FOREIGN KEY (user_id) REFERENCES users(id)"
  },
  {
    "constraint_name": "fkcaokd681y3t0iicdvkq5cgpop",
    "source_table": "admins",
    "target_table": "schools",
    "constraint_def": "FOREIGN KEY (school_id) REFERENCES schools(id)"
  },
  {
    "constraint_name": "fkd3f6enpb3p3xovee9klklf05r",
    "source_table": "certificates",
    "target_table": "users",
    "constraint_def": "FOREIGN KEY (user_id) REFERENCES users(id)"
  },
  {
    "constraint_name": "fkl3n73u370f543rs5eocwjoy1",
    "source_table": "chat_bookmarks",
    "target_table": "users",
    "constraint_def": "FOREIGN KEY (user_id) REFERENCES users(id)"
  },
  {
    "constraint_name": "fkf3aixx0twwt890xwy4ww8tkkm",
    "source_table": "chat_bookmarks",
    "target_table": "chat_messages",
    "constraint_def": "FOREIGN KEY (message_id) REFERENCES chat_messages(id)"
  },
  {
    "constraint_name": "fkqw6yblcx0hqkn34q6jg03bj8",
    "source_table": "chat_history",
    "target_table": "users",
    "constraint_def": "FOREIGN KEY (user_id) REFERENCES users(id)"
  },
  {
    "constraint_name": "fk3cpkdtwdxndrjhrx3gt9q5ux9",
    "source_table": "chat_messages",
    "target_table": "chat_sessions",
    "constraint_def": "FOREIGN KEY (session_id) REFERENCES chat_sessions(id)"
  },
  {
    "constraint_name": "fk82ky97glaomlmhjqae1d0esmy",
    "source_table": "chat_sessions",
    "target_table": "users",
    "constraint_def": "FOREIGN KEY (user_id) REFERENCES users(id)"
  },
  {
    "constraint_name": "fkhq1kbnaku0fsiw5t421djjk1c",
    "source_table": "conversation_feedbacks",
    "target_table": "speaking_sessions",
    "constraint_def": "FOREIGN KEY (session_id) REFERENCES speaking_sessions(id)"
  },
  {
    "constraint_name": "fk9h74u8iw7ee3wr1wlfdgqvbqk",
    "source_table": "conversation_messages",
    "target_table": "speaking_sessions",
    "constraint_def": "FOREIGN KEY (session_id) REFERENCES speaking_sessions(id)"
  },
  {
    "constraint_name": "fkldk9ybpe1d2wj1lb0qt0thh8v",
    "source_table": "grammar_history",
    "target_table": "users",
    "constraint_def": "FOREIGN KEY (user_id) REFERENCES users(id)"
  },
  {
    "constraint_name": "fkq6fs19k0gqw3rg0mb87h60h6p",
    "source_table": "invoices",
    "target_table": "payments",
    "constraint_def": "FOREIGN KEY (payment_id) REFERENCES payments(id)"
  },
  {
    "constraint_name": "fkqwr70bkn0j6gok1y4op9jns8y",
    "source_table": "lesson_progress",
    "target_table": "lessons",
    "constraint_def": "FOREIGN KEY (lesson_id) REFERENCES lessons(id)"
  },
  {
    "constraint_name": "fkhxwj6gbacmwi2768sceg602uf",
    "source_table": "lesson_progress",
    "target_table": "users",
    "constraint_def": "FOREIGN KEY (user_id) REFERENCES users(id)"
  },
  {
    "constraint_name": "fknk4ftb5am9ubmkv1661h15ds9",
    "source_table": "notification",
    "target_table": "users",
    "constraint_def": "FOREIGN KEY (user_id) REFERENCES users(id)"
  },
  {
    "constraint_name": "fk_onboarding_users_repair",
    "source_table": "onboarding",
    "target_table": "users",
    "constraint_def": "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE"
  },
  {
    "constraint_name": "fkj94hgy9v5fw1munb90tar2eje",
    "source_table": "payments",
    "target_table": "users",
    "constraint_def": "FOREIGN KEY (user_id) REFERENCES users(id)"
  },
  {
    "constraint_name": "fkqktpyvm52unwea52wlls77qes",
    "source_table": "payments",
    "target_table": "subscription_plans",
    "constraint_def": "FOREIGN KEY (subscription_plan_id) REFERENCES subscription_plans(id)"
  },
  {
    "constraint_name": "fk_progress_users_repair",
    "source_table": "progress",
    "target_table": "users",
    "constraint_def": "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE"
  },
  {
    "constraint_name": "fkpt9ic0j1y6xwlej99wnynvnpy",
    "source_table": "refunds",
    "target_table": "payments",
    "constraint_def": "FOREIGN KEY (payment_id) REFERENCES payments(id)"
  },
  {
    "constraint_name": "fkd01ywcs1umhms0bplqyy8axm0",
    "source_table": "results",
    "target_table": "users",
    "constraint_def": "FOREIGN KEY (student_id) REFERENCES users(id)"
  },
  {
    "constraint_name": "fkmvxun3j66ml9dgnaghcgq43ck",
    "source_table": "school_admins",
    "target_table": "users",
    "constraint_def": "FOREIGN KEY (user_id) REFERENCES users(id)"
  },
  {
    "constraint_name": "school_standards_school_id_fkey",
    "source_table": "school_standards",
    "target_table": "schools",
    "constraint_def": "FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE"
  },
  {
    "constraint_name": "fkf585xxww5h8b9up0ninp57tjs",
    "source_table": "settings",
    "target_table": "users",
    "constraint_def": "FOREIGN KEY (user_id) REFERENCES users(id)"
  },
  {
    "constraint_name": "fkta95be2xnlae5xr2rbqb8f7xa",
    "source_table": "speaking_sessions",
    "target_table": "users",
    "constraint_def": "FOREIGN KEY (user_id) REFERENCES users(id)"
  },
  {
    "constraint_name": "standard_divisions_school_standard_id_fkey",
    "source_table": "standard_divisions",
    "target_table": "school_standards",
    "constraint_def": "FOREIGN KEY (school_standard_id) REFERENCES school_standards(id) ON DELETE CASCADE"
  },
  {
    "constraint_name": "teacher_standard_divisions_standard_division_id_fkey",
    "source_table": "teacher_standard_divisions",
    "target_table": "standard_divisions",
    "constraint_def": "FOREIGN KEY (standard_division_id) REFERENCES standard_divisions(id) ON DELETE CASCADE"
  },
  {
    "constraint_name": "teacher_standard_divisions_teacher_id_fkey",
    "source_table": "teacher_standard_divisions",
    "target_table": "users",
    "constraint_def": "FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE"
  },
  {
    "constraint_name": "fkb8dct7w2j1vl1r2bpstw5isc0",
    "source_table": "teachers",
    "target_table": "users",
    "constraint_def": "FOREIGN KEY (user_id) REFERENCES users(id)"
  },
  {
    "constraint_name": "fk_teachers_users_id",
    "source_table": "teachers",
    "target_table": "users",
    "constraint_def": "FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE"
  },
  {
    "constraint_name": "fk3l40lbyji8kj5xoc20ycwsc8g",
    "source_table": "user_subscriptions",
    "target_table": "users",
    "constraint_def": "FOREIGN KEY (user_id) REFERENCES users(id)"
  },
  {
    "constraint_name": "fkadjprcghnwoju5p9wqx63wbot",
    "source_table": "user_subscriptions",
    "target_table": "subscription_plans",
    "constraint_def": "FOREIGN KEY (subscription_plan_id) REFERENCES subscription_plans(id)"
  },
  {
    "constraint_name": "fk3gj5j7vnsoxf1wp9n5hsqdiq3",
    "source_table": "users",
    "target_table": "schools",
    "constraint_def": "FOREIGN KEY (school_id) REFERENCES schools(id)"
  },
  {
    "constraint_name": "fk50fel7tsib4tpnuqa7irn7f5c",
    "source_table": "vocabulary",
    "target_table": "users",
    "constraint_def": "FOREIGN KEY (user_id) REFERENCES users(id)"
  }
];

async function applyFks() {
  const client = new Client({ connectionString: targetConnStr });
  await client.connect();

  console.log(`Applying ${foreignKeys.length} foreign key relationships to target database...`);
  let successCount = 0;

  for (const fk of foreignKeys) {
    try {
      await client.query(`ALTER TABLE public."${fk.source_table}" DROP CONSTRAINT IF EXISTS "${fk.constraint_name}";`);
      await client.query(`ALTER TABLE public."${fk.source_table}" ADD CONSTRAINT "${fk.constraint_name}" ${fk.constraint_def};`);
      console.log(`✅ Added FK: ${fk.source_table} -> ${fk.target_table} (${fk.constraint_def})`);
      successCount++;
    } catch (e) {
      console.warn(`❌ Failed to add FK ${fk.constraint_name} on ${fk.source_table}: ${e.message}`);
    }
  }

  console.log(`\nSuccessfully applied ${successCount} of ${foreignKeys.length} foreign key constraints!`);
  await client.end();
}

applyFks().catch(console.error);
